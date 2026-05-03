use serde::Deserialize;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::StreamExt;
use crate::discord::DiscordState;

#[derive(Deserialize, Debug)]
pub struct WsMessage {
    pub r#type: String,
    pub payload: Option<ActivityPayload>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct ActivityPayload {
    pub platform_id: String,
    pub details: String,
    pub state: String,
    pub timestamp_start: Option<i64>,
    pub timestamp_end: Option<i64>,
    #[serde(rename = "is_paused")]
    pub _is_paused: bool,
    pub is_shorts: Option<bool>,
    pub is_browsing: Option<bool>,
    pub large_image_key: Option<String>,
    pub large_text: Option<String>,
    pub small_image_key: Option<String>,
    pub small_text: Option<String>,
}

pub async fn start_server(discord_state: Arc<Mutex<DiscordState>>) {
    let addr = "127.0.0.1:3012";
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind WebSocket server: {}. ZarPresence might already be running.", e);
            return;
        }
    };
    println!("WebSocket server listening on {}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        let discord_state = discord_state.clone();
        tokio::spawn(async move {
            if let Ok(mut ws_stream) = accept_async(stream).await {
                println!("New WebSocket connection established");
                
                while let Some(Ok(msg)) = ws_stream.next().await {
                    if msg.is_text() {
                        let text = msg.to_text().unwrap();
                        if let Ok(data) = serde_json::from_str::<WsMessage>(text) {
                                let mut state = discord_state.lock().unwrap();
                                
                                match data.r#type.as_str() {
                                    "CLEAR" => {
                                        state.clear();
                                    }
                                    "ACTIVITY" => {
                                        if let Some(payload) = data.payload {
                                            state.update(&payload);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                }
                
                // Clear RPC on disconnect
                println!("WebSocket disconnected");
                let mut state = discord_state.lock().unwrap();
                state.clear();
            }
        });
    }
}
