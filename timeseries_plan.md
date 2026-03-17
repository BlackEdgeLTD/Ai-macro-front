# Time Series Plan

This file defines the time series needed to understand:

1. Macro real-estate trends in Israel
2. Broader macro trends in Israel

It is designed as an implementation plan, not just a data catalog.

Related reference:

- [boi_map.md](./boi_map.md)

## Planning Principles

- Start with a small set of canonical series per theme.
- Prefer one headline series plus one or two validating series.
- Prefer seasonally adjusted series when possible.
- Separate `level`, `change`, and `stress` signals.
- Use CBS for housing and construction structure.
- Use BOI for macro, finance, external sector, and expectations.

## Dashboard Structure

Build the product around 2 layers:

1. Macro Real-Estate
2. Macro

Each layer should have:

- headline indicators
- activity indicators
- financing indicators
- stress / imbalance indicators

## A. Macro Real-Estate Trends

### A1. Prices

Purpose:

- Track the direction and speed of housing prices versus general inflation.

Priority series:

- CBS housing price index
  - Source: existing repo uses `HOUSING_INDEX_CODE = 40010`
  - Role: headline house-price trend
- CBS CPI
  - Source: existing repo uses `CPI_CODE = 120010`
  - Role: deflate housing prices and compare shelter inflation with overall inflation
- CBS new dwelling price series
  - Source: existing repo already fetches new-dwelling data
  - Role: distinguish new-build pricing from broader resale-market pricing

Derived metrics:

- housing price YoY
- housing price minus CPI
- new dwellings versus total housing index gap

### A2. Transaction Volume

Purpose:

- Measure demand and liquidity in the housing market.

Priority series from current CBS mapping:

- `new_monthly`
  - new dwellings sold
- `secondhand_monthly`
  - second-hand dwellings sold
- `total_monthly`
  - total dwellings sold
- annual versions of the same series

Why:

- Prices alone are incomplete.
- Falling transactions with sticky prices usually signals market strain.

Derived metrics:

- 3-month moving average of transactions
- YoY change in total transactions
- new / second-hand mix

### A3. Supply Pipeline

Purpose:

- Understand whether the market is supply-constrained or absorbing excess supply.

Priority series from current CBS mapping:

- `build_monthly`
  - building permits
- `starts_monthly`
  - housing starts
- `finish_monthly`
  - completions
- `active_quarterly`
  - dwellings under active construction

Why:

- Permits show future intent.
- Starts show actual launch.
- Active construction shows pipeline congestion.
- Completions show supply reaching market.

Derived metrics:

- starts minus completions
- permits to starts ratio
- active construction trend

### A4. Inventory / Overhang

Purpose:

- Detect whether supply is accumulating faster than demand.

Priority series:

- CBS stock / inventory series
  - Source: existing repo uses `STOCK_SERIES_ID = 574362`
  - Role: unsold stock / inventory pressure
- total transactions
  - role: denominator for absorption

Derived metrics:

- months of supply
- stock-to-sales ratio

### A5. Geographic Dispersion

Purpose:

- See whether the cycle is nationwide or concentrated.

Priority regions already modeled in repo:

- Jerusalem
- North
- Haifa
- Center
- Tel Aviv
- South

Priority regional series:

- regional price index
- regional starts
- regional completions
- regional total sales

Why:

- Macro real-estate cycles often break regionally first.
- Tel Aviv and Center usually lead price and demand changes.

Derived metrics:

- region spread versus national
- leader / laggard ranking
- regional supply-demand imbalance

### A6. Financing Conditions

Purpose:

- Explain how tight money affects housing demand and affordability.

Priority series:

- BOI policy rate
  - Source: BOI public interest API
- housing credit outstanding
  - `BNK_99910_FR_FINREP_268`
  - total banking system housing credit to the public
- housing-loan stress / nonperforming housing credit
  - `BNK_99910_FR_FINREP_218`

Why:

- Housing is heavily rate-sensitive.
- Credit growth and bad-loan trends show whether financing is expanding or tightening.

Derived metrics:

- housing credit YoY
- housing credit / nominal GDP
- policy rate versus house-price growth

### A7. Urban Renewal / Structural Supply

Purpose:

- Distinguish short-cycle construction data from structural redevelopment trends.

Priority series from current CBS mapping:

- `start_total_q`
- `start_reconstruction_q`
- `start_additions_q`
- `start_TAMA38q`
- `destroyed_apartments_q`

Why:

- This captures the redevelopment side of Israel's housing supply, not just greenfield construction.

## Recommended Real-Estate Watchlist

If we keep only the highest-signal real-estate set:

- CBS housing price index
- CBS CPI
- new dwellings sold
- second-hand dwellings sold
- total dwellings sold
- building permits
- housing starts
- completions
- active construction
- unsold stock
- BOI policy rate
- BOI housing credit outstanding

## B. Macro Trends

### B1. Inflation and Monetary Regime

Purpose:

- Track inflation pressure, credibility, and policy stance.

Priority series:

- `CP_PCH`
  - CPI total
- `EXP_EXP_01Y_BI_MA`
  - 1-year inflation expectations
- `EXP_HAZ_MAD_AVG_01Y_MA`
  - forecasters' 12-month inflation projection
- `INF_MIN_TRGT_D`
- `INF_MAX_TRGT_D`
- BOI policy rate

Derived metrics:

- CPI YoY
- expectations versus actual inflation
- real policy rate proxy

### B2. Real Activity

Purpose:

- Track current-cycle growth before GDP releases catch up.

Priority series:

- `BOI_EAI_M`
  - Monthly Economic Activity Index
- `BOI_EAI_MVAVG3_M`
  - 3-month moving average
- `BI_PCT_GDP_A_FP`
  - GDP quantity change
- `BI_PCT_GDP_PER_CAPITA_Q_FP_SA`
  - GDP per capita quantity change
- `BI_PCT_GDP_BS_Q_FC_SA`
  - business sector GDP quantity change

Derived metrics:

- activity diffusion score
- quarterly nowcast proxy from monthly activity

### B3. Labor Market

Purpose:

- Track slack, labor tightness, and wage pressure.

Priority series:

- `UE_R_M_SA`
  - unemployment rate
- `UE_R_A25_64_M_SA`
  - prime-age unemployment
- `RW_M_CHAINED`
  - real wages total
- `AW_M_SA`
  - nominal wages total

Derived metrics:

- unemployment trend
- real wage growth
- wage growth minus inflation

### B4. FX and Financial Conditions

Purpose:

- Measure currency pressure and external-financial transmission.

Priority series:

- `RER_USD_ILS`
  - USD/ILS representative rate
- `RER_EUR_ILS`
  - EUR/ILS representative rate
- `NER_ILS_BSK_IDX`
  - nominal effective exchange rate
- `RER_ILS_BSK_IDX`
  - real effective exchange rate

Derived metrics:

- NIS strength / weakness regime
- FX versus inflation pass-through context

### B5. External Sector

Purpose:

- Understand whether the macro environment is supported by external surpluses or under stress.

Priority series:

- `BOP_NC1000N3_Q_SA`
  - current account total
- `BOP_NC1000N3_GDP_R_Q`
  - current account as % of GDP
- `BOP_N2A000N1_Q_SA`
  - services export
- `BOP_N2A000N2_Q_SA`
  - services import
- `ACC_RES2700018_D_B_ME`
  - FX reserves in USD

Derived metrics:

- current account balance regime
- reserves trend
- services surplus strength

### B6. Credit and Domestic Balance Sheet

Purpose:

- Track leverage and domestic financial sensitivity.

Priority series:

- housing credit outstanding
  - `BNK_99910_FR_FINREP_268`
- housing-loan nonperforming
  - `BNK_99910_FR_FINREP_218`

Next expansion candidates:

- household nonhousing credit
- business credit
- consumer credit stress

## Recommended Macro Watchlist

If we keep only the highest-signal macro set:

- BOI policy rate
- `CP_PCH`
- `EXP_EXP_01Y_BI_MA`
- `BOI_EAI_M`
- `UE_R_M_SA`
- `RW_M_CHAINED`
- `RER_USD_ILS`
- `NER_ILS_BSK_IDX`
- `ACC_RES2700018_D_B_ME`
- `BOP_NC1000N3_GDP_R_Q`
- `BI_PCT_GDP_A_FP`

## Combined Implementation Phases

### Phase 1

Build the smallest useful dashboard:

- policy rate
- CPI
- inflation expectations
- monthly activity
- unemployment
- real wages
- USD/ILS
- current account / GDP
- housing price index
- total housing transactions
- housing starts
- unsold stock

### Phase 2

Add structural real-estate depth:

- completions
- active construction
- regional breakdowns
- urban renewal block
- housing credit block

### Phase 3

Add richer macro context:

- GDP per capita
- business sector GDP
- FX reserves
- effective exchange rates
- services exports / imports

## Suggested UI Grouping

Top row:

- policy rate
- CPI YoY
- unemployment
- monthly activity

Real-estate row:

- housing prices
- transactions
- starts vs completions
- unsold stock

External / finance row:

- USD/ILS
- current account / GDP
- FX reserves
- housing credit

## Practical Conclusion

To understand Israel well, you do not need hundreds of series.

You need:

- one inflation block
- one activity block
- one labor block
- one external / FX block
- one housing-price block
- one housing-supply block
- one housing-finance block

That is enough to explain most of the macro and macro real-estate cycle.
