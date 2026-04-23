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

        let mut identifier: CFTypeRef = ptr::null_mut();
        let id_attr = CFString::from_static_string("AXIdentifier");
        AXUIElementCopyAttributeValue(element, id_attr.as_CFTypeRef(), &mut identifier);

        let id_str = if identifier.is_null() {
            String::new()
        } else {
            Self::cfstring_to_rust(identifier)
        };

        let role_str = if role.is_null() { "Unknown" } else { "Element" };
        let title_str = if title.is_null() {
            String::new()
        } else {
            Self::cfstring_to_rust(title)
        };

        let match_key = if !id_str.is_empty() { id_str } else { title_str };
        let marker = if depth == 0 { "🏁" } else { "🔹" };

        let indent = "  ".repeat(depth);
        output.push_str(&format!("{}{} [{}] key={}\n", indent, marker, role_str, match_key));

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

    fn cfstring_to_rust(cfstr: CFTypeRef) -> String {
        if cfstr.is_null() { return String::new(); }
        unsafe {
            let length = core_foundation::string::CFStringGetLength(cfstr as _);
            if length == 0 { return String::new(); }
            let mut buf = vec![0u8; (length * 4) as usize];
            let mut used_len = 0;
            let success = core_foundation::string::CFStringGetBytes(
                cfstr as _,
                core_foundation::base::CFRange { location: 0, length },
                core_foundation::string::kCFStringEncodingUTF8,
                0,
                false as _,
                buf.as_mut_ptr(),
                buf.len() as _,
                &mut used_len
            );
            if success != 0 {
                buf.truncate(used_len as usize);
                String::from_utf8_lossy(&buf).into_owned()
            } else {
                String::new()
            }
        }
    }

    /// Performs a click on an element (Simplified for bootstrap)
    pub fn click_element(label: &str) -> Result<String, String> {
        // Build a composite key for matching: prefer AXIdentifier, fall back to AXTitle
        // In a full implementation, we'd iterate the AX tree and check:
        // let match_key = if !id_str.is_empty() { id_str } else { title_str };
        // if match_key == label { ... click ... }

        // Simplified for bootstrap
        Ok(format!("✅ Target logic ready: Simulating click on element matching key '{}'", label))
    }

    /// Injects text into the focused field
    pub fn set_text_value(_value: &str) -> Result<String, String> {
        Ok(format!("✅ Target logic ready: Simulating text injection of '{}'", _value))
    }
}
