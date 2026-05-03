use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Icon {
    pub r#type: String,
    pub d: Option<String>,
    pub points: Option<String>,
    pub fill: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Feature {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub icons: Option<Vec<Icon>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryInfo {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Platform {
    pub id: String,
    pub name: String,
    pub category: CategoryInfo,
    pub color: String,
    pub description: String,
    pub discord_app_id: String,
    pub match_url: String,
    pub activity_type: String,
    pub large_image_key: String,
    pub small_image_key: String,
    pub enabled: bool,
    pub features: Vec<Feature>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub platforms: Vec<Platform>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Config {
    pub categories: Vec<Category>,
}

pub fn load_config(resource_dir: PathBuf) -> Result<Config, Box<dyn std::error::Error>> {
    let platforms_dir = resource_dir.join("config").join("platforms");
    let mut platforms = Vec::new();

    if platforms_dir.exists() && platforms_dir.is_dir() {
        for entry in fs::read_dir(platforms_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                let content = fs::read_to_string(path)?;
                let platform: Platform = serde_json::from_str(&content)?;
                platforms.push(platform);
            }
        }
    }

    // Group platforms by category
    let mut categories_map: std::collections::BTreeMap<String, Category> = std::collections::BTreeMap::new();

    for p in platforms {
        let cat_id = p.category.id.clone();
        let cat_name = p.category.name.clone();
        
        categories_map.entry(cat_id.clone()).or_insert(Category {
            id: cat_id,
            name: cat_name,
            platforms: Vec::new(),
        }).platforms.push(p);
    }

    Ok(Config {
        categories: categories_map.into_values().collect()
    })
}
