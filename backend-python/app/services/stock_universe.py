"""
NSE + BSE stock universe — organised by sector but flat-mergeable for whole-market scans.

This list covers the most actively traded ~280 stocks across both exchanges:
  • All Nifty 50 + Nifty Next 50 (top 100 by market cap)
  • Sectoral leaders and mid-caps from BSE 500
  • Active F&O stocks (high liquidity, suitable for analysis-based recommendations)

We intentionally cap the universe to liquid names so analysis is meaningful —
scanning illiquid penny stocks would surface unreliable signals.
"""

from typing import Dict, List, Set


SECTORS: Dict[str, List[str]] = {
    "IT & Software": [
        "TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "LTI", "MPHASIS", "PERSISTENT",
        "COFORGE", "LTTS", "OFSS", "BSOFT", "TATAELXSI", "KPITTECH", "ZENSARTECH",
        "INTELLECT", "RAMCOSYS", "FIRSTSOURCE", "MASTEK", "CYIENT",
    ],
    "PSU Banks": [
        "SBIN", "PNB", "BANKBARODA", "CANBK", "UNIONBANK", "INDIANB", "BANKINDIA",
        "MAHABANK", "CENTRALBK", "IOB", "UCOBANK", "PSB", "J&KBANK",
    ],
    "Private Banks": [
        "HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "INDUSINDBK",
        "FEDERALBNK", "IDFCFIRSTB", "BANDHANBNK", "RBLBANK", "YESBANK",
        "CITYUNIONBK", "DCBBANK", "AUBANK", "KARURVYSYA", "SOUTHBANK",
    ],
    "NBFC & Financial Services": [
        "BAJFINANCE", "BAJAJFINSV", "MUTHOOTFIN", "SHRIRAMFIN", "CHOLAFIN",
        "MANAPPURAM", "PFC", "RECLTD", "M&MFIN", "L&TFH", "LICHSGFIN",
        "PNBHOUSING", "IIFL", "ABCAPITAL", "HDFCLIFE", "SBILIFE",
        "ICICIPRULI", "ICICIGI", "MFSL", "POLICYBZR", "PAYTM",
    ],
    "Auto & Auto Components": [
        "MARUTI", "TATAMOTORS", "M&M", "BAJAJ-AUTO", "EICHERMOT", "ASHOKLEY",
        "TVSMOTOR", "HEROMOTOCO", "BOSCHLTD", "MOTHERSON", "MRF", "BHARATFORG",
        "BALKRISIND", "APOLLOTYRE", "EXIDEIND", "AMARAJABAT", "SUNDARMFIN",
        "ESCORTS", "ENDURANCE", "MINDAIND",
    ],
    "FMCG & Consumer": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR", "MARICO", "GODREJCP",
        "EMAMILTD", "TATACONSUM", "COLPAL", "UBL", "MCDOWELL-N", "VBL", "PGHH",
        "GILLETTE", "JYOTHYLAB", "RADICO", "AVANTIFEED", "PATANJALI",
    ],
    "Pharma & Healthcare": [
        "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "BIOCON", "LUPIN", "TORNTPHARM",
        "AUROPHARMA", "ZYDUSLIFE", "ALKEM", "ABBOTINDIA", "PFIZER", "GLAND",
        "GLENMARK", "IPCALAB", "LAURUSLABS", "AJANTPHARM", "NATCOPHARM",
        "MAXHEALTH", "APOLLOHOSP", "FORTIS", "METROPOLIS", "DRLAL", "SYNGENE",
    ],
    "Energy, Oil & Gas": [
        "RELIANCE", "ONGC", "BPCL", "HINDPETRO", "GAIL", "IOC", "PETRONET",
        "IGL", "MGL", "GUJGASLTD", "OIL", "MRPL", "AEGISCHEM", "CASTROLIND",
    ],
    "Metals & Mining": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "COALINDIA", "NMDC", "SAIL",
        "JINDALSTEL", "NATIONALUM", "HINDZINC", "MOIL", "APLAPOLLO", "RATNAMANI",
        "WELCORP", "JSL", "RAMCOCEM",
    ],
    "Capital Goods & Engineering": [
        "LT", "ABB", "BHEL", "SIEMENS", "CUMMINSIND", "HAL", "BEL", "TIINDIA",
        "BHARATFORG", "THERMAX", "ABBPOWER", "POWERMECH", "GRINDWELL", "TIMKEN",
        "SKFINDIA", "VOLTAS", "HONAUT", "GMRINFRA", "IRB", "KEC",
    ],
    "Power & Utilities": [
        "NTPC", "POWERGRID", "TATAPOWER", "ADANIPOWER", "CESC", "TORNTPOWER",
        "NHPC", "JSWENERGY", "ADANIGREEN", "ADANIENSOL", "SJVN", "IRCON",
        "RVNL", "RITES",
    ],
    "Real Estate": [
        "DLF", "GODREJPROP", "PRESTIGE", "OBEROIRLTY", "PHOENIXLTD", "BRIGADE",
        "SUNTECK", "SOBHA", "MAHLIFE", "LODHA", "INDIANHUME",
    ],
    "Telecom & Media": [
        "BHARTIARTL", "INDUSTOWER", "TATACOMM", "VODAFONE", "TEJAS", "STERLITE",
        "ZEEL", "PVRINOX", "SUNTV", "NETWORK18", "DBCORP", "JAGRAN", "TV18BRDCST",
    ],
    "Consumer Durables": [
        "HAVELLS", "TITAN", "VGUARD", "CROMPTON", "BLUESTARCO", "WHIRLPOOL",
        "DIXON", "AMBERENT", "ORIENTELEC", "BAJAJELEC", "RAJESHEXPO", "KAJARIACER",
        "CERA", "GREENPANEL",
    ],
    "Chemicals & Fertilizers": [
        "PIDILITIND", "DEEPAKNTR", "GNFC", "ATUL", "AARTIIND", "SRF", "TATACHEM",
        "NAVINFLUOR", "VINATIORGA", "FINEORG", "GUJFLUORO", "COROMANDEL",
        "CHAMBLFERT", "RALLIS", "PIIND", "UPL", "BAYERCROP", "SUMICHEM",
    ],
    "Cement & Construction": [
        "ULTRACEMCO", "SHREECEM", "AMBUJACEM", "ACC", "DALBHARAT", "JKCEMENT",
        "INDIACEM", "BIRLACORPN", "JKLAKSHMI", "ORIENTCEM", "HEIDELBERG",
    ],
    "Retail & E-commerce": [
        "DMART", "TRENT", "ABFRL", "SHOPERSTOP", "VMART", "WESTLIFE", "DEVYANI",
        "JUBLFOOD", "SAPPHIRE", "ZOMATO", "NYKAA", "NAUKRI",
    ],
    "Logistics & Aviation": [
        "INDIGO", "BLUEDART", "CONCOR", "ADANIPORTS", "GMRAIRPORT", "TCI",
        "MAHLOG", "VRLLOG", "ALLCARGO", "DELHIVERY", "SPICEJET",
    ],
    "Textiles & Garments": [
        "PAGEIND", "ARVIND", "VARDHMAN", "RAYMOND", "WELSPUNIND", "TRIDENT",
        "KPRMILL", "GARFIBRES", "VTL",
    ],
    "Indices": [
        "NIFTY50", "BANKNIFTY", "FINNIFTY", "MIDCAP50", "NIFTYNEXT50",
        "NIFTYIT", "NIFTYPHARMA", "NIFTYAUTO", "NIFTYFMCG", "NIFTYMETAL",
        "SENSEX", "BANKEX",
    ],
}


def all_symbols() -> List[str]:
    """Flatten every sector into one de-duplicated, alphabetically-ordered list."""
    seen: Set[str] = set()
    flat: List[str] = []
    for syms in SECTORS.values():
        for s in syms:
            if s not in seen:
                seen.add(s)
                flat.append(s)
    return sorted(flat)


def symbols_for_sector(sector: str) -> List[str]:
    if sector not in SECTORS:
        raise ValueError(f"Unknown sector '{sector}'. Available: {list(SECTORS.keys())}")
    return SECTORS[sector]


def sector_count() -> Dict[str, int]:
    return {k: len(v) for k, v in SECTORS.items()}


def total_universe_size() -> int:
    return len(all_symbols())
