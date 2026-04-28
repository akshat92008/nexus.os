use axum::{
    routing::get,
    Router,
};
use tower_http::cors::CorsLayer;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    println!("🚀 Nexus OS — Native API Sidecar starting...");

    // Basic health check route
    let app = Router::new()
        .route("/health", get(|| async { "Nexus OS Sidecar is ONLINE" }))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!("📡 Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
