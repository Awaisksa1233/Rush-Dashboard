# 🚗 RUSH Car Wash — Membership Retention & Revenue Intelligence

Welcome to the **RUSH Car Wash Retention Engine & Analytics Dashboard**. 

This system is designed to help RUSH Car Wash keep more monthly members, prevent cancellations, and recover lost subscription revenue—all while protecting the business from discount abuse.

---

## 🌟 What Does This System Do? (In Plain English)

When a car wash member decides to cancel their subscription, most businesses just let them go with a single click. That means **100% of that customer’s revenue is lost forever**.

This system changes that. Instead of an immediate cancellation, it guides the customer through a friendly, helpful 4-step conversation:
1. **Reminds them of the value they received** (e.g. *"You've washed 14 times and saved SAR 460 compared to single tickets!"*).
2. **Asks why they want to leave** (e.g. traveling for winter, tightening budget, or a quality issue).
3. **Presents one personalized alternative** specifically for their situation (like pausing their account for free instead of cancelling).
4. **Protects the business with automated guardrails** so customers cannot exploit discounts or game the system.

---

## 🎯 The 4 Core Features

### 1. 🛡️ Smart Cancellation Flow
Instead of a simple "Are you sure you want to cancel?" button, members experience a guided experience:
- **Value Summary**: Shows their total washes, months as a member, and total money saved.
- **Exit Survey**: Collects clear reasons (e.g., Seasonal break, Price, Wash quality, Relocation, Sold car).
- **Instant Save Options**: Gives them an easy reason to stay without feeling pressured.

---

### 2. 🎁 Tailored Save Offers (Presented One at a Time)
Different customers cancel for different reasons. The system automatically picks the **single best solution** for each person:

| If the customer says... | The system automatically offers... | Why it works |
| :--- | :--- | :--- |
| **"I'm traveling or it's winter"** | **60-Day Membership Freeze ($0/mo)** | They keep their car on file for free and auto-resume when they return. Zero cost to RUSH. |
| **"It's too expensive" (Nano Plan)** | **Switch to Shiny Plan (SAR 69/mo)** | They save SAR 100/mo while keeping unlimited washes. RUSH keeps SAR 69/mo instead of SAR 0. |
| **"It's too expensive" (Base Plan)** | **25% Off for 2 Months** | Gives them temporary budget relief so they don't leave. |
| **"I had a bad wash experience"** | **2 Free Interior Detail Passes + VIP Manager Callback** | Fixes their service issue directly instead of giving a cheap price discount. |
| **"I sold my car or moved"** | **90-Day Plate Transfer & Hold** | Lets them transfer their remaining plan to a new car or family member with zero restart fees. |

> **Why only one offer at a time?**  
> Showing a long list of discounts confuses customers and encourages them to pick the biggest discount. Showing **one focused offer** tailored to their exact reason has the highest chance of saving them while protecting company profit.

---

### 3. 🔒 Anti-Abuse Security Shield
To ensure customers don't exploit the system or repeatedly claim discounts:
- **180-Day Cooldown**: A customer can only receive 1 save discount or pause every 6 months.
- **30-Day Minimum Membership**: Brand-new members cannot immediately claim cancellation discounts.
- **90-Day Annual Pause Limit**: Prevents members from freezing accounts indefinitely.
- **Automated Enforcement**: If a customer doesn't qualify, the system automatically hides promotional offers and proceeds with standard support.

---

### 4. 📊 Retention & Churn Dashboard (For Managers)
A full command center for RUSH branch and executive managers:
- **Live Save Rate**: Track the percentage of cancelling members saved (currently **~54%**).
- **Preserved Revenue**: See the exact monthly revenue (SAR) kept in the business.
- **Interactive Simulator**: Test how the cancellation flow looks and behaves for 5 different customer personas (*Power Washer, Winter Snowbird, Budget-Conscious Driver, Repeat Offender, New Member*).
- **Exit Survey Breakdown**: Understand the exact reasons customers leave and how much revenue is tied to each reason.
- **Live Audit Feed**: Review recent cancellation attempts, accepted save offers, and blocked abuse attempts in real time.

---

## 💰 How This Helps the Business

For a typical car wash with **2,000 active members**:
- **Saves ~54 members every month** who would have otherwise cancelled.
- **Protects over SAR 420,000 / year** in recurring membership revenue.
- **Saves ~SAR 97,000 / year** in marketing costs that would be spent trying to re-acquire lost customers.
- **Stops revenue leaks** by blocking unauthorized discount claims through the Anti-Abuse Shield.

---

## 👥 How to Use the System (Quick Guide for Staff)

1. **Viewing Saved Members & Statistics**:
   - Click **"Retention & Save Flows"** in the top navigation or sidebar.
   - Review your live Save Rate, Paused Members count, and Preserved MRR.
2. **Testing the Cancellation Experience**:
   - In the Retention tab, scroll to the **"Cancellation Flow & Persona Simulator"**.
   - Click **"Test Cancel Flow"** on any persona to see how the system tailors the offer and verifies abuse rules.
3. **Launching Flow for a Real Member**:
   - Go to **"Active Fleet"** or **"Memberships & Churn"**.
   - Click the **"Cancel Flow →"** button on any customer row to launch the guided retention assistant.

---

## 🚀 How to Run the Application

If you are running the dashboard locally on your computer:

```bash
# 1. Install dependencies
npm install

# 2. Start the full application (Backend API + Dashboard UI)
npm run dev:full
```

Open your web browser and visit: **`http://localhost:5173`**

## 📚 Documentation & KPI Guide

- [**Executive KPI Calculations Guide (docs/KPI_CALCULATIONS_GUIDE.md)**](docs/KPI_CALCULATIONS_GUIDE.md) — Comprehensive business-level summary explaining how all revenue, membership, churn, and fleet KPIs are calculated across the dashboard.

---

*“Efficient Speed, Exceptional Clean. Results in just 6 minutes.”*  
**RUSH Car Wash (رش) — Al Kharj, Kingdom of Saudi Arabia**
