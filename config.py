from pathlib import Path
import yaml

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.yaml"


with open(CONFIG_PATH, "r", encoding="utf-8") as file:
    config = yaml.safe_load(file)


print("Nova AI Workspace configuration loaded successfully.")
print(config)