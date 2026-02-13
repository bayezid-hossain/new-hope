# Poultry Management System - Feature Overview

This document outlines the features and capabilities of the poultry management system, organized by functional area.

## 1. Authentication & Organization Management
**Core User & Access Control**
*   **Organization Joining:** Users can request to join an organization with a specific role (Manager or Officer).
*   **Role-Based Access Control (RBAC):**
    *   **Admin:** Full system access.
    *   **Owner:** Full organization access.
    *   **Manager:** Can manage officers, farmers, and view reports. Can be restricted to "View Only" mode.
    *   **Officer:** Manages assigned farmers, cycles, and daily operations.
*   **Membership Management:**
    *   Approve pending member requests.
    *   Update member roles (Manager/Officer) and access levels (View/Edit).
    *   Activate/Deactivate members.
    *   Remove members from the organization.
*   **Organization Dashboard:** Provides high-level statistics on members, farmers, and active cycles.

## 2. Farmer Management
**Profile & Relationship Management**
*   **Farmer Profiles:** Create, update, and manage detailed farmer profiles including location and contact info.
*   **Bulk Import:** Create multiple farmer profiles at once for rapid onboarding.
*   **Performance Benchmarking (Pro):** Compare a farmer's performance (mortality rate, FCR) against the organization's average.
*   **Security Money Tracking:** Manage security deposits for farmers with a full audit log of changes.
*   **Officer Assignment:** Farmers are assigned to specific officers for dedicated management.
*   **Lifecycle Management:** Soft-delete (archive) and restore farmer profiles, preserving historical data.

## 3. Production Cycle Management
**Batch Tracking & Operations**
*   **Cycle Creation:** Start new production cycles for farmers, defining initial bird count (DOC), age, and bird type.
*   **Bulk Cycle Creation:** Start cycles for multiple farmers simultaneously.
*   **Daily Operations:**
    *   **Mortality Recording:** Log daily mortality with reasons.
    *   **Feed Management:** Automatically tracks feed consumption based on age and bird count. Supports manual adjustments.
    *   **Growth Tracking:** Monitor age and bird development.
*   **Corrections & Adjustments:**
    *   Correct initial bird count (DOC) and age with audit logging.
    *   Edit or revert mortality logs to fix data entry errors.
*   **Cycle Completion:** End cycles when all birds are sold or consumed.
*   **Reopen Cycle:** Reopen mistakenly closed cycles to continue operations or correct data.
*   **History & Logs:** View detailed logs of all activities (mortality, sales, feed, system changes) for every cycle.

## 4. Feed & Inventory Management
**Stock Control & Supply Chain**
*   **Stock Ledger:** Comprehensive history of all stock movements (additions, deductions, transfers).
*   **Stock Operations:**
    *   **Add Stock:** Manually add feed/medicine stock to a farmer's inventory.
    *   **Deduct Stock:** Manually remove stock for usage or corrections.
    *   **Transfer Stock:** Transfer stock between farmers with tracking.
*   **Bulk Stock Import (Pro):** Add stock to multiple farmers in a single batch operation.
*   **Feed Orders:**
    *   Create and manage feed orders for farmers.
    *   Confirm orders to automatically update farmer stock levels.
    *   Track delivery status and driver details.
*   **Consumption Tracking:** Real-time calculation of feed consumption based on active cycles.

## 5. Sales Management
**Revenue & Distribution**
*   **Sale Recording:** Record sales of birds including weight, price per kg, and buyer details.
*   **Metrics Calculation:** Automatically calculates FCR (Feed Conversion Ratio) and EPI (European Performance Index) for completed cycles.
*   **Financial Tracking:** Track cash and deposit received, medicine costs, and total revenue per sale.
*   **Sale Adjustments:**
    *   Create new versions of sale reports to correct errors (weight, price, mortality).
    *   Set active versions for reporting accuracy.
*   **History & Trends:** View sales history by cycle, farmer, or officer.

## 6. DOC (Day-Old Chick) Orders
**Procurement**
*   **Order Management:** Create, update, and delete DOC orders for farmers.
*   **Bird Types:** Manage different bird types/strains (e.g., Cobb 500, Ross 308).
*   **Order Confirmation:** Confirm DOC orders to automatically convert them into active production cycles.

## 7. Reports & Analytics
**Business Intelligence**
*   **Dashboard Stats:** Real-time overview of total birds, feed stock, active consumption, and low stock alerts.
*   **Sales Summary:** Comprehensive sales reports filtered by date range, providing revenue, weight, and bird count analysis.
*   **Sales Ledger:** Detailed transaction history for specific farmers.
*   **Stock Summary:** Current stock levels across the entire organization.
*   **Performance Reports (Pro):**
    *   **Annual Performance:** Year-over-year analysis of production metrics.
    *   **Monthly Production:** Detailed breakdown of chicks placed, sold, mortality, and feed usage per month.
*   **Officer Analytics:** Performance metrics for individual officers (farmers managed, active cycles, mortality rates).

## 8. AI & Automation
**Smart Features**
*   **Data Extraction:**
    *   **Farmer Extraction:** Automatically extract farmer names and feed orders from unstructured text (e.g., SMS/WhatsApp messages).
    *   **Order Parsing:** Parse complex cycle order details (dates, quantities) from text.
*   **Risk Assessment:** AI-driven analysis of active cycles to identify high mortality risks or rising trends.
*   **Supply Chain Prediction:** Predict potential stockouts based on current consumption rates and remaining stock.

## 9. Notifications & System
**Communication & Alerts**
*   **In-App Notifications:** Real-time alerts for critical events (mortality spikes, low stock, new orders).
*   **Role-Based Targeting:** Notifications are routed to relevant Managers and Officers.
*   **Audit Logging:** detailed system logs for all sensitive actions (corrections, deletions, transfers).
