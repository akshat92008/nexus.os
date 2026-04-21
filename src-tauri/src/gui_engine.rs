use objc::{msg_send, sel, sel_impl};
use objc::runtime::{Object, Sel};
use objc_id::Id;
use core_foundation::base::TCFType;
use core_foundation::string::CFString;
use core_foundation::base::CFTypeRef;
use std::ptr;

// Forward declarations for macOS Accessibility constants
// In a real production environment, these would be linked from ApplicationServices
extern "C" {
    fn AXUIElementCreateSystemWide() -> CFTypeRef;
    fn AXUIElementCopyAttributeValue(element: CFTypeRef, attribute: CFTypeRef, value: *mut CFTypeRef) -> i32;
    fn AXUIElementPerformAction(element: CFTypeRef, action: CFTypeRef) -> i32;
    fn AXIsProcessTrusted() -> bool;
}

pub struct GuiEngine;

impl GuiEngine {
    /// Check if the app has Accessibility permissions
    pub fn is_trusted() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    /// Captures the UI Hierarchy of the currently focused window
    pub fn get_ui_hierarchy() -> Result<String, String> {
        if !Self::is_trusted() {
            return Err("Accessibility permissions not granted. Please enable in System Settings.".to_string());
        }

        unsafe {
            let system_wide = AXUIElementCreateSystemWide();
            if system_wide.is_null() {
                return Err("Failed to create system wide AX element".to_string());
            }

            // Get the focused application
            let mut focused_app: CFTypeRef = ptr::null_mut();
            let attr_name = CFString::from_static_string("AXFocusedApplication");
            let status = AXUIElementCopyAttributeValue(system_wide, attr_name.as_CFTypeRef(), &mut focused_app);

            if status != 0 || focused_app.is_null() {
                return Err("Could not find focused application".to_string());
            }

            // Recursively build a simplified tree (logic simplified for this implementation)
            let mut tree = String::from("🖥️ GUI HIERARCHY:\n");
            Self::traverse_element(focused_app, 0, &mut tree);
            
            Ok(tree)
        }
    }

    /// Internal recursive traversal of AX elements
    unsafe fn traverse_element(element: CFTypeRef, depth: usize, output: &mut String) {
        if depth > 5 { return; } // Prevent infinite recursion

        let mut role: CFTypeRef = ptr::null_mut();
        let role_attr = CFString::from_static_string("AXRole");
        AXUIElementCopyAttributeValue(element, role_attr.as_CFTypeRef(), &mut role);

        let mut title: CFTypeRef = ptr::null_mut();
        let title_attr = CFString::from_static_string("AXTitle");
        AXUIElementCopyAttributeValue(element, title_attr.as_CFTypeRef(), &mut title);

        let role_str = if role.is_null() { "Unknown" } else { "Element" };
        let title_str = if title.is_null() { "" } else { " - Title: ..." };

        let indent = "  ".repeat(depth);
        output.push_str(&format!("{}{} [{}] {}\n", indent, if depth == 0 { "🏁" } else { "🔹" }, role_str, title_str));

        // Get children
        let mut children: CFTypeRef = ptr::null_mut();
        let children_attr = CFString::from_static_string("AXChildren");
        let status = AXUIElementCopyAttributeValue(element, children_attr.as_CFTypeRef(), &mut children);

        if status == 0 && !children.is_null() {
            // Note: In real Rust/ObjC bridge, you'd iterate the NSArray here.
            // Simplified for the current Phase 4 bootstrap.
            output.push_str(&format!("{}  (Scanning children...)\n", indent));
        }
    }

    /// Performs a click on an element (Simplified for bootstrap)
    pub fn click_element(_label: &str) -> Result<String, String> {
        // Real implementation would find element by label then AXUIElementPerformAction
        Ok(format!("✅ Target logic ready: Simulating click on '{}'", _label))
    }

    /// Injects text into the focused field
    pub fn set_text_value(_value: &str) -> Result<String, String> {
        Ok(format!("✅ Target logic ready: Simulating text injection of '{}'", _value))
    }

    /// Computes the Levenshtein distance between two strings
    fn levenshtein(a: &str, b: &str) -> usize {
        let a_chars: Vec<char> = a.chars().collect();
        let b_chars: Vec<char> = b.chars().collect();
        let mut matrix = vec![vec![0; b_chars.len() + 1]; a_chars.len() + 1];

        for i in 0..=a_chars.len() { matrix[i][0] = i; }
        for j in 0..=b_chars.len() { matrix[0][j] = j; }

        for i in 1..=a_chars.len() {
            for j in 1..=b_chars.len() {
                let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
                matrix[i][j] = std::cmp::min(
                    std::cmp::min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1),
                    matrix[i - 1][j - 1] + cost,
                );
            }
        }
        matrix[a_chars.len()][b_chars.len()]
    }

    /// Finds an element using Levenshtein distance on title/role and structural validation via AX tree path.
    pub fn find_element_fuzzy(label: &str, _expected_path_hints: Option<Vec<&str>>) -> Result<String, String> {
        // Mocking the structural pathing and Levenshtein logic for Phase 4 bootstrap.
        // We simulate finding a close match.
        let target = "Save Document";
        let distance = Self::levenshtein(label, target);

        if distance <= 3 {
             Ok(format!("Found fuzzy match: '{}' (distance: {})", target, distance))
        } else {
             Err(format!("Could not find element matching '{}' within acceptable distance", label))
        }
    }

    /// Verifies that a specific element state has changed after an action.
    pub fn verify_gui_state(_pre_action_tree: &str, _action: &str) -> Result<bool, String> {
        // Mocks taking a post-action screenshot/tree capture and comparing.
        Ok(true)
    }
}
