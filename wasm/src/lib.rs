use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MindMapNode {
    id: String,
    label: String,
    #[serde(rename = "type")]
    node_type: String,
    parent_id: Option<String>,
    location: Option<String>,
    documentation: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MindMapEdge {
    from: String,
    to: String,
    relationship: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MindMapGraph {
    repository_url: String,
    nodes: Vec<MindMapNode>,
    edges: Vec<MindMapEdge>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalysisResult {
    graph: MindMapGraph,
    warnings: Vec<String>,
}

fn build_mock_graph(repository_url: &str) -> AnalysisResult {
    AnalysisResult {
        graph: MindMapGraph {
            repository_url: repository_url.to_string(),
            nodes: vec![
                MindMapNode {
                    id: "repo".to_owned(),
                    label: repository_url.to_owned(),
                    node_type: "repository".to_owned(),
                    parent_id: None,
                    location: None,
                    documentation: None,
                },
                MindMapNode {
                    id: "file:placeholder".to_owned(),
                    label: "src/lib.rs".to_owned(),
                    node_type: "file".to_owned(),
                    parent_id: Some("repo".to_owned()),
                    location: Some("src/lib.rs".to_owned()),
                    documentation: None,
                },
                MindMapNode {
                    id: "function:bootstrap".to_owned(),
                    label: "bootstrap".to_owned(),
                    node_type: "function".to_owned(),
                    parent_id: Some("file:placeholder".to_owned()),
                    location: Some("src/lib.rs:42".to_owned()),
                    documentation: Some("Entry point for repository analysis.".to_owned()),
                },
            ],
            edges: vec![
                MindMapEdge {
                    from: "repo".to_owned(),
                    to: "file:placeholder".to_owned(),
                    relationship: "contains".to_owned(),
                },
                MindMapEdge {
                    from: "file:placeholder".to_owned(),
                    to: "function:bootstrap".to_owned(),
                    relationship: "contains".to_owned(),
                },
            ],
        },
        warnings: vec!["This is a mock analysis. Implement language parsers to replace it.".to_owned()],
    }
}

#[wasm_bindgen]
pub fn wasm_graph_from_repo(repository_url: &str) -> String {
    serde_json::to_string(&build_mock_graph(repository_url)).unwrap_or_else(|_| "{}".to_string())
}

#[wasm_bindgen]
pub fn wasm_graph_from_source(_source: &str) -> String {
    serde_json::to_string(&build_mock_graph("local-source")).unwrap_or_else(|_| "{}".to_string())
}
