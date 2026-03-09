# Derivatives Verification Workflow

Before any derivative is elevated from candidate to recommendation:

1. Verify underlying-symbol mapping.
2. Verify instrument type (CBBC, warrant, option, LEAP).
3. Verify call/barrier/strike/expiry/ratio from a trusted source.
4. Record issuer / venue.
5. Record bid, ask, spread, volume, turnover, and outstanding when available.
6. Mark verification status:
   - `unverified`
   - `partial`
   - `verified`
7. Do not present `unverified` products as high-confidence trade suggestions.

## Extra checks for HK CBBC / warrants
- KO/call buffer vs current underlying price
- liquidity deterioration risk near barrier
- outstanding concentration risk
- likely spread behavior under fast markets

## Extra checks for US options / LEAPS
- IV level and term structure
- theta decay
- option volume / OI
- earnings event proximity
