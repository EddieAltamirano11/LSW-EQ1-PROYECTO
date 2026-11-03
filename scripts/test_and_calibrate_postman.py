import requests
import json

BASE_URL = "http://localhost:3050/api/v1"

print("=" * 70)
print("--- TESTEANDO Y CALIBRANDO TUTORIAL WEBULL (NVDA) ---")
print("=" * 70)

# 1. Quote Webull NVDA
r_w_quote = requests.get(f"{BASE_URL}/broker/quote/NVDA", headers={"x-broker-selection": "WEBULL"}).json()
spot_nvda = r_w_quote.get("lastPrice")
bid_nvda = r_w_quote.get("bid")
ask_nvda = r_w_quote.get("ask")
print(f"1. NVDA Spot: ${spot_nvda} (Bid: ${bid_nvda}, Ask: ${ask_nvda})")

# 2. Options chain Webull NVDA
r_w_chain = requests.get(f"{BASE_URL}/broker/options-chain/NVDA?expiration=2026-10-16", headers={"x-broker-selection": "WEBULL"}).json()
print(f"2. NVDA Chain: {r_w_chain.get('contractsCount')} contratos disponibles.")

# 3. Recommend PUT Webull NVDA
r_w_put = requests.get(f"{BASE_URL}/hedging/recommend-option/NVDA?type=PUT&broker=WEBULL&moneyness=OTM").json()
rec_w_put = r_w_put.get("recommendedContract", {})
print(f"3. PUT Recomendado: {rec_w_put.get('contractSymbol')} | Strike: ${rec_w_put.get('strike')} | Premium: ${rec_w_put.get('marketPremium')} (Bid: ${rec_w_put.get('bid')}, Ask: ${rec_w_put.get('ask')})")

# 4. Recommend CALL Webull NVDA
r_w_call = requests.get(f"{BASE_URL}/hedging/recommend-option/NVDA?type=CALL&broker=WEBULL&moneyness=OTM").json()
rec_w_call = r_w_call.get("recommendedContract", {})
print(f"4. CALL Recomendado: {rec_w_call.get('contractSymbol')} | Strike: ${rec_w_call.get('strike')} | Premium: ${rec_w_call.get('marketPremium')} (Bid: ${rec_w_call.get('bid')}, Ask: ${rec_w_call.get('ask')})")

print("\n" + "=" * 70)
print("--- TESTEANDO Y CALIBRANDO TUTORIAL ALPACA (AAPL) ---")
print("=" * 70)

# 1. Quote Alpaca AAPL
r_a_quote = requests.get(f"{BASE_URL}/broker/quote/AAPL", headers={"x-broker-selection": "ALPACA"}).json()
spot_aapl = r_a_quote.get("lastPrice")
bid_aapl = r_a_quote.get("bid")
ask_aapl = r_a_quote.get("ask")
print(f"1. AAPL Spot: ${spot_aapl} (Bid: ${bid_aapl}, Ask: ${ask_aapl})")

# 2. Options chain Alpaca AAPL
r_a_chain = requests.get(f"{BASE_URL}/broker/options-chain/AAPL?expiration=2026-10-16", headers={"x-broker-selection": "ALPACA"}).json()
print(f"2. AAPL Chain: {r_a_chain.get('contractsCount')} contratos disponibles.")

# 3. Recommend PUT Alpaca AAPL
r_a_put = requests.get(f"{BASE_URL}/hedging/recommend-option/AAPL?type=PUT&broker=ALPACA&moneyness=OTM").json()
rec_a_put = r_a_put.get("recommendedContract", {})
print(f"3. PUT Recomendado: {rec_a_put.get('contractSymbol')} | Strike: ${rec_a_put.get('strike')} | Premium: ${rec_a_put.get('marketPremium')} (Bid: ${rec_a_put.get('bid')}, Ask: ${rec_a_put.get('ask')})")

# 4. Recommend CALL Alpaca AAPL
r_a_call = requests.get(f"{BASE_URL}/hedging/recommend-option/AAPL?type=CALL&broker=ALPACA&moneyness=OTM").json()
rec_a_call = r_a_call.get("recommendedContract", {})
print(f"4. CALL Recomendado: {rec_a_call.get('contractSymbol')} | Strike: ${rec_a_call.get('strike')} | Premium: ${rec_a_call.get('marketPremium')} (Bid: ${rec_a_call.get('bid')}, Ask: ${rec_a_call.get('ask')})")

