# RUSH Wash CRM — KPI Calculation Guide & Methodology

This document outlines the formulas, definitions, data sources, and business logic used to compute all Key Performance Indicators (KPIs) across the **RUSH Dashboard**.

---

## 1. Executive & High-Level KPIs

### 1.1 Net Revenue (Period Revenue)
- **Definition**: Total realized monetary inflow from subscriptions, renewal billings, single-wash retail purchases, and add-on services during the selected time period.
- **Data Source**: MongoDB collections `rushwash_sale_orders` (paid state) and Moyasar payment settlements.
- **Formula**:
  $$\text{Period Revenue} = \text{Baseline 30d Inflow} \times \left( \frac{\text{Days in Selected Period}}{30} \right)$$
- **Period-over-Period Change ($\Delta\%$):**
  $$\Delta\% = \left( \frac{\text{Period Revenue} - \text{Previous Period Revenue}}{\text{Previous Period Revenue}} \right) \times 100\%$$
- **Code Reference**: [`analyticsService.ts:L188-L199`](file:///c:/Users/Rush/Documents/antigravity/gallant-volta/src/services/analyticsService.ts#L188-L199)

---

### 1.2 Monthly Recurring Revenue (MRR)
- **Definition**: The normalized monthly subscription revenue committed by all active members.
- **Data Source**: Active documents in `rushwash_subscriptions` mapped against package catalog [`PACKAGES`](file:///c:/Users/Rush/Documents/antigravity/gallant-volta/src/data/packages.ts).
- **Formula**:
  $$\text{Closing MRR} = \sum_{m \in \text{Active Members}} \text{MonthlyPrice}(m.\text{packageTier})$$
- **Package Pricing Schedule**:
  | Package Code | Package Name | Monthly Price (SAR) |
  | :--- | :--- | :--- |
  | `SPK-00001` | Fresh Wash | 100 |
  | `SPK-00002` | Shiny Wash | 69 |
  | `SPK-00003` | Nano Ceramic | 169 |
  | `SPK-00004` | Interior Clean | 79 |
  | `SPK-00005` | Nano + Interior | 219 |
  | `SPK-00006` | Shiny + Interior | 119 |

---

### 1.3 MRR Movement Waterfall
- **Definition**: Bridges the transition of MRR from the beginning of the period to the close.
- **Formula**:
  $$\text{Opening MRR} = \text{Closing MRR} + \text{Churned MRR} + \text{Failed Payment MRR} - \text{New MRR} - \text{Reactivation MRR}$$
  $$\text{Net MRR Movement} = \text{Closing MRR} - \text{Opening MRR}$$
- **Components**:
  - **New MRR**: First-time subscriptions acquired during the period.
  - **Reactivation MRR**: Former churned members who restarted their subscription.
  - **Expansion MRR**: Members upgrading to higher tiers (e.g. Fresh $\rightarrow$ Nano).
  - **Churned MRR**: MRR lost to voluntary member cancellations ($\text{Count} \times \text{Plan Price}$).
  - **Failed Payment MRR**: MRR temporarily or permanently delinquent due to card declines.

---

### 1.4 Active Valid Memberships
- **Definition**: Total unique vehicles/customers with a valid, non-expired subscription entitled to tunnel washes.
- **Formula**:
  $$N_{\text{valid}} = \text{Count}\Big( \{ s \in \text{Subscriptions} \mid s.\text{status} = \text{'active'} \land s.\text{expiresAt} \ge \text{Current Date} \} \Big)$$
- **Sub-segments**:
  - **Auto-Renewing Members**: Members with a valid Moyasar token enabled for automated renewal.
  - **Cancelled (Valid until expiry)**: Members who requested cancellation but whose paid monthly period is still running.

---

### 1.5 Net Member Growth
- **Definition**: The net change in the active membership roster over the period.
- **Formula**:
  $$\text{Net Growth} = (N_{\text{new}} + N_{\text{reactivated}}) - (N_{\text{voluntary\_churn}} + N_{\text{involuntary\_churn}})$$
- **Code Reference**: [`analyticsService.ts:L210-L216`](file:///c:/Users/Rush/Documents/antigravity/gallant-volta/src/services/analyticsService.ts#L210-L216)

---

### 1.6 Renewal Collection Rate
- **Definition**: The effectiveness of the automated payment gateway in capturing monthly renewal billings.
- **Formula**:
  $$\text{Collection Rate (\%)} = \left( \frac{\text{First-Try Successful Payments} + \text{Recovered Payments}}{\text{Total Renewals Due}} \right) \times 100\%$$
- **Components**:
  - **Renewals Due**: Subscriptions reaching their expiration date in the current billing cycle.
  - **First-Try Success**: Payments captured on the primary scheduled attempt.
  - **Failed Payments**: Initial declines returned by Mada/Visa/Mastercard (e.g., Code 51 *Insufficient Funds*, Code 54 *Expired Card*).
  - **Recovered Payments**: Delinquent subscriptions successfully collected via automated dunning retries.

---

### 1.7 Churn Rate
- **Definition**: The percentage of subscribers lost within the measurement window relative to the active customer base.
- **Formula**:
  $$\text{Eligible Starting Base} = N_{\text{closing}} + N_{\text{voluntary\_churn}} + N_{\text{involuntary\_churn}}$$
  $$\text{Total Churn Rate (\%)} = \left( \frac{N_{\text{voluntary\_churn}} + N_{\text{involuntary\_churn}}}{\text{Eligible Starting Base}} \right) \times 100\%$$
- **Categorization**:
  - **Voluntary Churn Rate**: Customers explicitly requesting cancellation through customer service or the `/cancel` portal.
  - **Involuntary Churn Rate**: Subscriptions terminated due to exhausted payment retries with unrecoverable cards.

---

## 2. Customer Value & Economics

### 2.1 Average Revenue Per Member (ARPM / ARPU)
- **Definition**: The average monthly recurring revenue contributed per active member.
- **Formula**:
  $$\text{ARPM} = \frac{\text{Total Closing MRR}}{N_{\text{valid}}}$$
- **Typical Range**: SAR 130 – SAR 145 across the blended customer package mix.

---

### 2.2 Customer Lifetime Value (LTV)
- **Definition**: The total gross revenue expected from a customer over the entire duration of their relationship with RUSH.
- **Formula**:
  $$\text{LTV} = \text{ARPM} \times \text{Average Customer Lifetime (Months)}$$
  where:
  $$\text{Average Customer Lifetime} = \frac{1}{\text{Monthly Voluntary Churn Rate}}$$
  *(or empirical tenure average: $\approx 4.8 - 6.0\text{ months}$ calculated from historical DB cancellations).*
- **Code Reference**: [`analyticsService.ts:L651-L662`](file:///c:/Users/Rush/Documents/antigravity/gallant-volta/src/services/analyticsService.ts#L651-L662)

---

### 2.3 Cohort Retention Rate
- **Definition**: Tracks customer cohorts grouped by the calendar month of their initial signup and measures the percentage still active after $n$ months.
- **Formula for Cohort Month $C$ at Month $n$**:
  $$\text{Retention Rate}_{C, n} = \left( \frac{\text{Members of Cohort } C \text{ active in Month } n}{\text{Initial Joined Members of Cohort } C} \right) \times 100\%$$
- **Benchmark Thresholds**:
  - **Month 1 Retention**: $> 92\%$ (Target healthy onboarding)
  - **Month 3 Retention**: $> 80\%$ (Stable habit formation)
  - **Month 6 Retention**: $> 72\%$ (Core loyal advocates)

---

## 3. Wash Operations & Fleet Capacity

### 3.1 Average Washes per Member per Month
- **Definition**: The average frequency at which active subscription members pass through the tunnel.
- **Formula**:
  $$\text{Average Washes/Member} = \frac{\text{Total Member Washes Recorded in Period}}{N_{\text{valid}}}$$
- **Data Source**: RFID gate transactions and scan events from `rushwash_wash_histories`.

---

### 3.2 Revenue per Wash
- **Definition**: The realized yield per wash event across the tunnel.
- **Formula**:
  $$\text{Revenue per Wash} = \frac{\text{Total Net Revenue}}{\text{Total Washes Recorded}}$$

---

### 3.3 Member Utilization Segmentation (Sleeper vs. Heavy)
Members are classified based on their monthly tunnel usage to predict churn risk:
| Tier Name | Washes/Month | Engagement Level | Risk Level |
| :--- | :--- | :--- | :--- |
| **0 Washes (Sleepers)** | 0 | Inactive / At Risk | High Churn Risk (Target for SMS / WhatsApp win-back) |
| **1–2 Washes** | 1 – 2 | Casual Regular | Moderate / Under-utilizing plan benefits |
| **3–5 Washes** | 3 – 5 | Optimal Core | Lowest Churn / High Retention |
| **6–10 Washes** | 6 – 10 | Power User | Heavy tunnel engagement |
| **10+ Washes** | $\ge 11$ | Super User / Fleet | Highest tunnel utilization |

---

### 3.4 Tunnel Hourly Capacity Utilization
- **Definition**: The percentage of maximum hourly mechanical capacity utilized by the wash tunnel.
- **Formula**:
  $$\text{Hourly Capacity Utilization (\%)} = \left( \frac{\text{Cars Washed in Hour } h}{\text{Rated Hourly Tunnel Capacity (e.g. 40 cars/hour)}} \right) \times 100\%$$
- **Peak Identification**: Hours with $\ge 80\%$ utilization are designated as **Peak Hours**.

---

## 4. Sales Representative & Branch KPIs

### 4.1 Lane Conversion Rate
- **Definition**: The efficiency of express lane sales representatives in converting drive-up drivers into recurring monthly subscribers.
- **Formula**:
  $$\text{Lane Conversion Rate (\%)} = \left( \frac{\text{Subscriptions Sold by Rep}}{\text{Total Customer Pitches Recorded}} \right) \times 100\%$$

---

### 4.2 Quota Attainment
- **Definition**: Individual or team progress against monthly target quotas.
- **Formula**:
  $$\text{Quota Attainment (\%)} = \left( \frac{\text{Actual Units Sold}}{\text{Target Quota Units}} \right) \times 100\%$$

---

### 4.3 Sales Commission Engine
- **Definition**: Representative earnings calculated dynamically via [`commission_engine.py`](file:///c:/Users/Rush/Documents/antigravity/gallant-volta/commission_engine.py).
- **Rules**:
  - Base commission per package tier sold (higher incentive for premium tiers: Nano Ceramic & Add-on packages).
  - Volume accelerators triggered when reps achieve $> 100\%$ and $> 120\%$ of their monthly quota.
  - Deduction rules for immediate same-week chargebacks/refunds.

---

## 5. Summary Reference Matrix

| Metric Name | Calculation Formula | Refresh Frequency | Target Benchmark |
| :--- | :--- | :--- | :--- |
| **Net Revenue** | $\sum \text{Orders} - \text{Refunds}$ | Real-time / Daily | Continuous Growth |
| **MRR** | $\sum \text{Active Plan Prices}$ | Real-time | Continuous Growth |
| **Active Members** | $\text{Count}(s.\text{status} = \text{'active'})$ | Real-time | $> 1,800$ cars |
| **Renewal Collection** | $\frac{\text{Success}}{\text{Renewals Due}} \times 100\%$ | Daily batch | $\ge 90\%$ |
| **Churn Rate** | $\frac{\text{Lost}}{\text{Base}} \times 100\%$ | Monthly | $\le 8.5\%$ |
| **ARPM** | $\frac{\text{MRR}}{\text{Members}}$ | Real-time | $\ge \text{SAR } 135$ |
| **LTV** | $\text{ARPM} \times \text{Lifetime}$ | Monthly | $\ge \text{SAR } 750$ |
| **Avg Washes/Member** | $\frac{\text{Washes}}{\text{Members}}$ | Monthly | $2.8 - 3.5$ washes |
