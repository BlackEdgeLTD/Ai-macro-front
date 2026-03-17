# BOI Macro Data Map

This file maps the Bank of Israel public data sources into a practical macro dashboard for Israel.

## Main Endpoints

- BOI Edge search: `https://edge.boi.gov.il/FusionEdgeServer/ws/public/datasearch`
- BOI Edge product info: `https://edge.boi.gov.il/FusionEdgeServer/ws/fusion/info/product`
- BOI Edge SDMX v2 base: `https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2`
- BOI public interest API: `https://www.boi.org.il/PublicApi/GetInterest`
- BOI public FX API: `https://www.boi.org.il/PublicApi/GetExchangeRates`

## Recommended Macro Dashboard

The highest-signal BOI series for a first Israel macro dashboard are:

1. Policy rate
2. CPI / inflation
3. Inflation expectations
4. Monthly activity index
5. Unemployment
6. Real wages
7. USD/ILS
8. Nominal effective exchange rate
9. FX reserves
10. Current account
11. GDP growth
12. Housing credit
13. Rent index
14. Mortgage rates
15. New mortgage volume
16. Government bond yields
17. Fiscal balance
18. Money supply
19. Construction costs

## Series Map

### 1. Policy Rate

Preferred source:

- Public API: `GetInterest`

Why:

- Cleaner than the Edge search results for policy-rate use.
- Best for latest official BOI rate.

### 2. CPI / Inflation

Dataflow:

- `BOI.STATISTICS:PRI`

Priority series:

- `CP_PCH`
  - Consumer Price Index - Total

Notes:

- Use this as the main inflation trend anchor.
- If needed later, add CPI components from the same dataflow.

### 3. Inflation Expectations

Dataflow:

- `BOI.STATISTICS:ZCM`

Priority series:

- `EXP_EXP_01Y_BI_MA`
  - Inflation expectations for the first year
- `EXP_HAZ_MAD_AVG_01Y_MA`
  - Average of forecasters' inflation projections for the coming 12 months
- `EXP_EXB_ZD_5Y_MA`
  - 5-year inflation expectations derived from the capital market
- `EXP_EXB_ZD_10Y_MA`
  - 10-year inflation expectations derived from the capital market
- `INF_MIN_TRGT_D`
  - Inflation target range - lower bound
- `INF_MAX_TRGT_D`
  - Inflation target range - upper bound

Notes:

- This is the best BOI dataflow for inflation expectations and target bands.

### 4. Activity

Dataflow:

- `BOI.STATISTICS:ECON_IND`

Priority series:

- `BOI_EAI_M`
  - The Monthly Economic Activity Index (without smoothing)
- `BOI_EAI_MVAVG3_M`
  - The Monthly Economic Activity Index - 3-month moving average

Notes:

- This is the cleanest high-frequency real-activity signal in BOI Edge.

### 5. Labor Market

Dataflow:

- `BOI.STATISTICS:LBM`

Priority series:

- `UE_R_M_SA`
  - Unemployment rate
- `UE_R_Q_SA`
  - Unemployment - Rate
- `UE_R_A25_64_M_SA`
  - Unemployment rate - total 25-64

Notes:

- Prefer seasonally adjusted monthly series where available.

### 6. Wages

Dataflow:

- `BOI.STATISTICS:LBM`

Priority series:

- `RW_M_CHAINED`
  - Average monthly real wages per employee post - Total
- `RW_NO_FRN_M_CHAINED`
  - Average monthly real wages per employee post - Total - Israelis
- `AW_M_SA`
  - Average monthly wages per employee post - Total

Notes:

- Real wages are better than nominal wages for macro monitoring.

### 7. FX

Preferred latest source:

- Public API: `GetExchangeRates`

Historical source:

- `BOI.STATISTICS:EXR`

Priority series:

- `RER_USD_ILS`
  - Representative Exchange Rate US dollar / New Israeli shekel
- `RER_EUR_ILS`
  - Representative Exchange Rate Euro / New Israeli shekel
- `NER_ILS_BSK_IDX`
  - Nominal effective exchange rate (NIS / basket) - Index
- `RER_ILS_BSK_IDX`
  - Real effective exchange rate (NIS / basket) - Index

Notes:

- Use the public API for latest point-in-time FX.
- Use `EXR` for history and effective-rate trends.

### 8. FX Reserves

Dataflow:

- `BOI.STATISTICS:ACC`

Priority series:

- `ACC_RES2700018_D_B_ME`
  - Foreign Exchange Reserves - USD
- `ACC_RES2700018_D_B_ME_R_GDP`
  - Foreign exchange reserves as % of GDP - Israel
- `ACC_RES2700018_S_B_ME`
  - Foreign Exchange Reserves - NIS

Notes:

- USD level plus reserves/GDP is enough for a first view.

### 9. External Balance

Dataflow:

- `BOI.STATISTICS:BOP`

Priority series:

- `BOP_NC1000N3_Q_SA`
  - Current account - total
- `BOP_NC1000N3_GDP_R_Q`
  - Current account - % of GDP
- `BOP_N2A000N1_Q_SA`
  - Current account - services export
- `BOP_N2A000N2_Q_SA`
  - Current account - services import

Notes:

- Current account as % of GDP is the most compact external-balance signal.

### 10. GDP and Growth

Dataflow:

- `BOI.STATISTICS:NA`

Priority series:

- `BI_PCT_GDP_A_FP`
  - Gross domestic product - Quantity change
- `BI_PCT_GDP_PER_CAPITA_Q_FP_SA`
  - GDP per capita - Quantity change
- `BI_PCT_GDP_BS_Q_FC_SA`
  - GDP - Business sector - at basis price - Quantity change

Notes:

- For dashboard use, quantity change is usually more useful than level.

### 11. Housing / Credit

Dataflow:

- `BOI.STATISTICS:BFR_99`

Priority series:

- `BNK_99910_FR_FINREP_268`
  - Total banking system (consolidated) - Domestic activity, households (excl. private banking), of which: housing loans - credit to the public
- `BNK_99910_FR_FINREP_248`
  - Total banking system - Credit - Private individuals - housing loans
- `BNK_99910_FR_FINREP_218`
  - Total banking system - Credit - Private individuals - housing loans - nonperforming

Notes:

- This is the best BOI route if you want housing-credit stress, credit growth, or mortgage exposure.

### 12. Rent Index

Dataflow:

- `BOI.STATISTICS:PRI`

Priority series:

- `CP020100`
  - Consumer Price Index - Rent (שכר דירה)
- `CP020100_PCH`
  - CPI Rent - percent change (month-over-month)
- `CP020100_PCHYTY`
  - CPI Rent - percent change (year-over-year)
- `CP020100_CNTR_CP`
  - CPI Rent - contribution to overall CPI

Notes:

- The rent index is part of the CPI shelter component in the PRI dataflow.
- Unlocks price-to-rent ratio when combined with the housing price index.
- Rent diverging from purchase prices is a key valuation signal.

### 13. Mortgage Rates

Dataflow:

- `BOI.STATISTICS:BIR_MRTG_99`

Priority series:

- `BNK_99034_LR_BIR_MRTG_462`
  - Interest rate - Housing loans to households, variable and fixed rate, not indexed (new business) - Total banking system
- `BNK_99034_LR_BIR_MRTG_1485`
  - Interest rate - Housing loans, CPI-indexed (new business) - Total banking system
- `BNK_99034_LR_BIR_MRTG_689`
  - Interest rate - Housing loans, foreign-currency-indexed (new business) - Total banking system

Notes:

- BOI segments mortgage rates by indexation track (non-indexed, CPI-indexed, FX-indexed).
- The non-indexed series (`_462`) is the most commonly cited headline rate.
- This is the transmission mechanism between the policy rate and housing demand.
- No single weighted-average series exists; track all three for a complete picture.

### 14. New Mortgage Volume

Dataflow:

- `BOI.STATISTICS:BIR_MRTG_99`

Priority series:

- `BNK_99034_LR_BIR_MRTG_897`
  - Business volumes - Housing loans to households, total index segments (new business) - Total banking system (NIS amount)
- `BNK_99034_LR_BIR_MRTG_63`
  - Number of new housing loans - total index segments (count)

Notes:

- Credit outstanding (section 11) is a stock. New mortgage volume is a flow.
- A drop in new mortgage volume typically leads price softening by 3-6 months.
- Track both NIS amount and loan count to detect average-loan-size shifts.

### 15. Government Bond Yields

Dataflow:

- `BOI.STATISTICS:SECDWH` (daily)
- `BOI.STATISTICS:ZCM` (monthly averages)

Priority series:

- `BS125`
  - Nominal government bond yield curve - 10-year maturity (daily)
- `ZC_TSB_ZND_10Y_MA`
  - Nominal rate of return from zero-coupon yield curve, 10 years (monthly average)
- `ZC_TSB_ZRD_10Y_MA`
  - Real rate of return from zero-coupon yield curve, 10 years (monthly average)
- `DWH_SRC_0309_MA`
  - Gross yield to maturity of CPI-indexed government bonds, fixed interest, 10 years (monthly average)

Notes:

- The 10-year yield anchors the discount rate for real estate valuation.
- Use `ZCM` monthly averages for dashboard charts; use `SECDWH` daily data for real-time monitoring.
- Real yield (`ZC_TSB_ZRD_10Y_MA`) minus inflation expectations gives the term premium signal.

### 16. Fiscal Balance

Dataflow:

- `BOI.STATISTICS:PS`

Priority series:

- `OZAR_A5TZM_M`
  - Total deficit - Central government - excluding credit (monthly)
- `DEF_TOTAL_R_GDP_A`
  - Total deficit, general government, as % of GDP (annual)
- `MOF_DEF_Q_N`
  - Total deficit - Central government (quarterly)

Notes:

- Fiscal balance connects to bond supply, yields, mortgage rates, and housing.
- The monthly series is noisy; prefer rolling 12-month sums or the quarterly series for trends.
- Deficit as % of GDP is the best single number for cross-cycle comparison.

### 17. Money Supply

Dataflow:

- `BOI.STATISTICS:MAG`

Priority series:

- `MAG_M1_SA_M`
  - Monetary aggregate M1 (seasonally adjusted, monthly)
- `MAG_RDB_M2_MA`
  - Monetary aggregate M2 (monthly)
- `MAG_BROAD_MONEY_M_E_SA`
  - Broad money (seasonally adjusted, estimated, monthly)

Notes:

- Money supply growth often leads asset prices (including housing) by several months.
- M1 expansion + low rates = strong housing demand signal.
- BOI does not publish an explicit M3; their broadest aggregate is called "Broad Money".

### 18. Construction Costs

Dataflow:

- `BOI.STATISTICS:PRI`

Priority series:

- `BIP`
  - Construction inputs price index - Total
- `BIP01`
  - Construction inputs price index - Total excluding wages
- `BIP_4`
  - Residential construction input price index - excluding wages

Notes:

- Tracks cost-push inflation in the construction sector.
- Rising construction costs slow completions and reprice new supply higher.
- Compare with housing price index to see margin compression or expansion.

## Suggested First Implementation

If we only implement 10-12 series, use this list:

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
- `BI_PCT_GDP_PER_CAPITA_Q_FP_SA`
- `BNK_99910_FR_FINREP_268`

Plus direct public APIs:

- `GetInterest`
- `GetExchangeRates`

## Suggested Phase 2 Series

High-value additions that fill analytical gaps:

- `CP020100` — Rent index (unlocks price-to-rent valuation)
- `BNK_99034_LR_BIR_MRTG_897` — New mortgage volume (leading demand indicator)
- `BNK_99034_LR_BIR_MRTG_462` — Average new mortgage rate (transmission mechanism)
- `ZC_TSB_ZND_10Y_MA` — 10Y government bond yield (anchors rate framework)
- `OZAR_A5TZM_M` — Government deficit monthly (fiscal impulse)
- `MAG_M1_SA_M` — M1 money supply (liquidity conditions)
- `BIP` — Construction cost index (supply-side constraint)

## Cross-Series Derived Metrics

These combine series from both phases into high-signal composite indicators:

- Real mortgage rate = avg mortgage rate (`_462`) minus inflation expectations (`EXP_EXP_01Y_BI_MA`)
- Price-to-rent ratio = housing price index / rent index (`CP020100`)
- Affordability ratio = housing price index / real wages (`RW_M_CHAINED`)
- Housing credit impulse = change in credit outstanding (`FINREP_268`) / nominal GDP
- Fiscal impulse = change in government deficit (`OZAR_A5TZM_M`) / GDP
- Real bond yield = 10Y nominal (`ZC_TSB_ZND_10Y_MA`) minus inflation expectations
- Supply absorption rate = total transactions / unsold stock

## Search Examples

Keyword search examples:

```text
https://edge.boi.gov.il/FusionEdgeServer/ws/public/datasearch?query=inflation
https://edge.boi.gov.il/FusionEdgeServer/ws/public/datasearch?query=unemployment
https://edge.boi.gov.il/FusionEdgeServer/ws/public/datasearch?query=current%20account
https://edge.boi.gov.il/FusionEdgeServer/ws/public/datasearch?query=monthly%20index%20of%20economic%20activity
```

## Implementation Notes

- Use BOI public APIs for latest policy rate and latest FX.
- Use BOI Edge for historical macro series and the broader dashboard.
- Start with one canonical series per topic before adding breakdowns.
- Prefer seasonally adjusted series when both adjusted and unadjusted variants exist.
- Normalize the output to:
  - `series_key`
  - `series_label`
  - `observation_date`
  - `value`
  - `unit`
  - `category`
