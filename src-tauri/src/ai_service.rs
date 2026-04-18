use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;

#[derive(Serialize, Deserialize, Debug)]
pub struct BrainRequest {
    pub message: String,
    pub session_id: String,
    pub history: Vec<ChatMessage>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BrainResponse {
    pub intent: String,
    pub tool: String,
    pub params: serde_json::Value,
    pub explanation: String,
}

pub struct AIService {
    client: Client,
    base_url: String,
}

impl AIService {
    pub fn new() -> Self {
        // Default to local dev brain, can be overridden by env
        let base_url = env::var("BRAIN_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());
        Self {
            client: Client::new(),
            base_url,
        }
    }

    pub async fn think(&self, message: &str, session_id: &str, history: Vec<ChatMessage>) -> Result<BrainResponse, String> {
        let url = format!("{}/think", self.base_url);
        
        let request = BrainRequest {
            message: message.to_string(),
            session_id: session_id.to_string(),
            history,
        };

        let response = self.client.post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Brain Error: Server returned status {}", response.status()));
        }

        let brain_res: BrainResponse = response.json()
            .await
            .map_err(|e| format!("JSON parse error: {}", e))?;

        Ok(brain_res)
    }
}
