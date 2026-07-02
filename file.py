import pandas as pd

BASE = "/Users/sakshamjain/Documents/transfer-data-analysis/archive/"

transfers = pd.read_csv(f"{BASE}transfers.csv")
valuations = pd.read_csv(f"{BASE}player_valuations.csv")
appearances = pd.read_csv(f"{BASE}appearances.csv")
players = pd.read_csv(f"{BASE}players.csv")
competitions = pd.read_csv(f"{BASE}competitions.csv")

print(competitions[competitions['competition_id'].isin(['GB1','ES1','FR1','IT1','L1'])][['competition_id','name','country_name']])