# Geopolitical Turbulance Trapper — Development Plan v1

## 1. Project identity

**Project name:** Geopolitical Turbulance Trapper

**Project type:** small-scale event-driven trading intelligence and derivatives decision-support system

**Primary goal:**
Track real-time geopolitical, macro, commodity, earnings, and market information across HK, US, and AU focus markets; map those drivers into actionable short-term trading setups on target shares, indices, and derivatives.

**What it should help answer:**
- What is the current regime: panic, rebound, chop, commodity shock, AI-infra momentum, earnings squeeze, or mixed?
- Which names are most exposed or most resilient?
- Which derivative type is appropriate right now: CBBC, warrant, put/call, bear/bull, options, LEAPS, or no trade?
- Where is the buying zone, danger zone, take-profit zone, and do-not-chase zone?
- What is the liquidity and execution risk of the proposed instrument under fast markets?

---

## 2. Why this project exists

The market backdrop is dominated by overlapping uncertainty and thematic opportunity:
- Middle East and other geopolitical instability
- oil and commodity shocks
- AI breakthrough and infrastructure capex trends favoring shovel providers
- earnings season with likely beats in selected names
- elevated chop and false breaks across HK tech and global risk assets

This project is intended to convert those overlapping narratives into a structured, repeatable workflow that is more reliable than ad-hoc chat analysis.

---

## 3. Target scope

### 3.1 Markets
- **HK** — first MVP priority
- **US** — second priority
- **AU** — later extension after HK logic is stable

### 3.2 Core watchlist (initial)

#### HK
- Tencent
- Alibaba
- Xiaomi
- HSI
- HSTECH

#### US
- Google
- TSM
- later candidates: NVDA, AMD, META, oil/metal-linked names

#### Asia ex-HK
- Samsung
- SK Hynix

#### Macro / driver instruments
- Brent crude
- WTI crude
- gold
- USD / FX proxies
- volatility indicators
- rates / bond-yield proxies (later)

---

## 4. Product goals

### 4.1 Primary system goals
User-selected primary goals already implied by prior drafts:
- signal when to buy/sell derivatives
- predict likely short-term direction
- detect volatility spikes for risk management

### 4.2 Output format
Primary output should be a **dashboard with visual alerts**, supported by rule-based textual recommendations.

### 4.3 Decision support outputs
Per target / instrument, the system should output:
- directional bias
- volatility regime
- event/risk tags
- candidate derivative types
- buying zone
- danger zone
- reduce/exit zone
- liquidity risk review
- execution warning
- confidence / evidence level

---

## 5. Hard requirements

### 5.1 Facts before opinions
The system must never rely on unverified AI-generated product facts.

Examples of facts that must be independently verified before a product recommendation is considered high-confidence:
- product code
- underlying
- issuer
- call level / strike / barrier
- expiry
- ratio / entitlement
- bid / ask / spread
- volume / turnover
- outstanding / open interest proxy

### 5.2 Bear as well as bull
The system must support:
- bull tools
- bear tools
- paired / hedge structures
- staged switch strategies (e.g. panic shield then rebound capture)

### 5.3 Liquidity and execution risk are first-class
The system must explicitly evaluate:
- historic volume / turnover behavior
- spread widening under sharp market moves
- issuer quote reliability proxy
- outstanding concentration risk
- risk of delayed or partial order execution in fast markets

### 5.4 Strict execution discipline
Every recommendation should include:
- entry condition
- invalidation condition
- stop / reduce rule
- no-chase rule
- special event warning (earnings, geopolitical headline, overnight gap)

---

## 6. What we learned from earlier prototypes

### 6.1 What is worth keeping
Earlier dashboard/system prototypes had useful ideas:
- dashboard-first output
- signal cards
- volatility gauge / regime logic
- signal breakdown panel
- CBBC knock-out buffer monitoring
- derivatives recommendation panel
- macro/geopolitical controls
- modular code layout: config / data / models / signals / backtest / dashboard

### 6.2 What must be changed
Earlier drafts were too weak in several areas:
- derivatives facts were too easy to hardcode or hallucinate
- AI was implicitly trusted as a facts layer
- HK-only framing is now too narrow
- strategy logic was too biased toward bullish rebound capture
- liquidity/outstanding risk was not elevated enough
- external data quality and verification rules were not strict enough

### 6.3 New design principle
**AI should be the explanation layer, not the source of truth layer.**

Correct order:
1. real data collection
2. product metadata verification
3. market regime + rule engine
4. risk engine
5. AI explanation / summarization
6. dashboard rendering

---

## 7. High-level system architecture

## Module A — Event Radar
Track and classify relevant events:
- geopolitical headlines
- sanctions / conflict escalation / de-escalation
- earnings and guidance
- AI infra / capex headlines
- commodity shocks
- supply chain and policy headlines

Output:
- event tag
- affected names / sectors / markets
- severity score
- estimated duration
- confidence score

## Module B — Market Regime Engine
Infer current regime using price, volatility, and macro data.

Candidate regimes:
- panic sell
- dead-cat bounce
- high-volatility range/chop
- commodity shock
- earnings squeeze setup
- AI infra momentum
- mixed/conflicted regime

Output:
- regime label
- supporting evidence
- derivatives suitability rules

## Module C — Instrument Scanner
Scan available instruments by market.

### HK
- CBBC bull / bear
- call / put warrants

### US
- options
- LEAPS

Output fields per candidate:
- code / contract id
- underlying
- type
- strike / call / barrier
- expiry
- issuer / venue
- current price
- spread
- volume / turnover
- outstanding / OI proxy
- KO buffer or moneyness
- liquidity risk score

## Module D — Signal / Opportunity Engine
Map:
- event state
- regime state
- underlying price behavior
- instrument characteristics
into concrete setups.

Examples:
- panic leg using HSI/HSTECH bear
- rebound leg using Tencent / Alibaba call or deeper-buffer bull
- earnings-beat volatility capture
- AI-infra continuation for TSM / SK Hynix / Samsung

## Module E — Risk Engine
Must evaluate:
- direction risk
- overnight gap risk
- KO risk
- IV crush / theta risk
- spread/quote deterioration
- outstanding crowding risk
- no-fill / late-fill risk

## Module F — Dashboard / UI
Main user-facing layer.

Panels:
1. macro / event panel
2. market watch panel
3. target name cards
4. derivatives action panel
5. liquidity and execution risk panel
6. alerts / watchlist / danger monitor

---

## 8. Recommended dashboard layout

### Top bar
- live status indicator
- last refresh time
- market regime badge
- geo risk badge
- volatility badge

### Panel 1 — Macro Snapshot
- Brent / WTI
- gold
- volatility index / proxy
- FX / rates proxy
- event severity highlights

### Panel 2 — Target Monitor
Per target card:
- latest price / move
- short-term bias
- earnings timing
- event sensitivity
- volatility regime
- support / resistance / danger zone

### Panel 3 — Derivatives Board
For each target:
- curated candidate instruments
- risk tier
- liquidity tier
- recommended usage (bear leg / rebound leg / hedge / avoid)
- entry zone / danger zone / exit rules

### Panel 4 — Signal Breakdown
Explain why a signal exists:
- price action
- event driver
- volatility state
- commodity linkage
- earnings proximity
- liquidity constraints

### Panel 5 — Alerts
- KO proximity alert
- spread widening alert
- geo shock alert
- earnings-event alert
- strategy invalidation alert

---

## 9. Data-source strategy

## 9.1 Principles
- prioritize official or near-official sources for derivative metadata
- tolerate lower-quality sources only for non-critical exploratory fields
- label confidence level per field

## 9.2 Proposed source layers

### Layer 1 — Market prices / broad data
- Yahoo Finance or equivalent for fast prototyping
- later upgradeable market data sources as needed

### Layer 2 — HK derivatives metadata
- HKEX and issuer pages as the primary truth sources
- avoid trusting chat-provided product codes without verification

### Layer 3 — Event/news layer
- curated RSS / news APIs / official releases
- event classification and severity tagging

### Layer 4 — Liquidity/risk layer
- live bid/ask if available
- turnover and volume history
- outstanding
- historical spread/quote behavior if feasible

---

## 10. Strategy framework (v1)

The system should support multiple strategy families instead of one bullish mean-reversion script.

### Strategy family A — Panic shield
Use broad-market or tech-index bear exposure to capture the first risk-off leg.

### Strategy family B — Rebound capture
After panic exhaustion, rotate into deeper-buffer bull or call structures on high-quality rebound targets.

### Strategy family C — Chop capture
In high-volatility ranges, prefer instruments and rules suited to repeated swings rather than one-direction conviction.

### Strategy family D — Earnings-driven asymmetry
Focus on names likely to beat expectations but still exposed to macro risk; choose derivatives based on IV, timing, and gap risk.

### Strategy family E — Theme continuation
AI infra / semiconductor / commodity-linked continuation trades in US and Asia.

---

## 11. MVP definition

## 11.1 MVP objective
Prove that the system can produce **fact-checked, risk-aware, visually presented trade setups** for HK targets under geopolitical uncertainty.

## 11.2 MVP market scope
HK only, first:
- HSI
- HSTECH
- Tencent
- Alibaba
- Xiaomi

## 11.3 MVP instrument scope
- HK CBBC bull / bear
- HK call / put warrants

## 11.4 MVP deliverables
1. project brief
2. schema / data model
3. dashboard wireframe
4. regime + signal framework
5. derivatives verification workflow
6. liquidity risk framework
7. first working dashboard prototype

---

## 12. Suggested implementation phases

### Phase 0 — Project reset and reference audit
- inventory the old Claude draft and earlier dashboard concepts
- identify reusable files vs files to rewrite
- avoid blindly inheriting hardcoded product facts

### Phase 1 — Brief + schemas
Create:
- project brief
- event schema
- target schema
- derivative schema
- risk schema
- alert schema

### Phase 2 — HK data and verification layer
Build:
- target price ingestion
- macro ingestion
- HK derivative metadata verification workflow
- confidence labels for each field

### Phase 3 — Regime + risk engine
Implement:
- event tags
- market regime rules
- liquidity/execution risk scoring
- CBBC safety buffer logic
- warrant suitability rules

### Phase 4 — HK dashboard MVP
Build dashboard panels with:
- macro snapshot
- target cards
- derivatives table
- risk panel
- alert panel

### Phase 5 — Strategy logic expansion
Add:
- bear + bull + combo workflows
- panic/rebound/chop playbooks
- staged switching logic

### Phase 6 — US extension
Add:
- Google
- TSM
- options / LEAPS framework

### Phase 7 — AU extension
Add AU market target mapping if still valuable after HK/US validation.

---

## 13. Technical stance

### 13.1 What to de-prioritize for now
Do **not** start by over-investing in:
- complex ML pipelines
- fancy explainability layers
- model competitions
- aggressive backtesting sophistication before data integrity is solved

### 13.2 What to prioritize instead
Prioritize:
1. data correctness
2. product verification
3. rule clarity
4. risk engine
5. dashboard usability
6. AI-generated summaries only after the above are stable

---

## 14. Reuse plan for the existing Claude draft

### Keep as likely reusable
- folder structure
- README framing as a prototype
- Streamlit dashboard skeleton
- some parameter organization
- some risk-parameter naming

### Rewrite or heavily audit
- hardcoded derivative codes and assumptions
- data sources and fetch logic
- signal engine directional assumptions
- over-reliance on ML-first thinking
- liquidity scoring
- bear/combination strategy support

---

## 15. Immediate next steps

1. create the formal project brief in repo/docs
2. extract the reusable structure from the Claude draft
3. define clean schemas for targets, instruments, and alerts
4. design the derivatives verification workflow
5. define the first HK-only dashboard MVP panels
6. begin implementation with data correctness first

---

## 16. Success criteria for v1

The project counts as successful only if it can do all of the following for MVP HK targets:
- produce a coherent market regime classification
- provide instrument candidates with verified metadata
- identify buy / danger / exit zones
- explain when to prefer bear vs bull vs warrant vs no trade
- surface liquidity/execution risk clearly
- present all of this in a usable visual dashboard

---

## 17. Guiding principle

**This system should help survive uncertainty, not hallucinate confidence.**

That means:
- facts before opinions
- rules before vibes
- verified products before flashy recommendations
- liquidity and execution warnings before leveraged enthusiasm
