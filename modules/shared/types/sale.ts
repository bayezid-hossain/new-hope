import type { FeedItem } from "./feed";

export interface SaleReport {
    id: string;
    birdsSold: number;
    totalMortality?: number | null;
    totalWeight: string;
    avgWeight: string;
    pricePerKg: string;
    totalAmount: string;
    cashReceived?: string | null;
    depositReceived?: string | null;
    medicineCost?: string | null;
    adjustmentNote?: string | null;
    feedConsumed?: string | null;
    feedStock?: string | null;
    createdAt: Date;
    createdByUser?: {
        name: string;
    };
}

export interface SaleEvent {
    id: string;
    cycleId?: string | null;
    historyId?: string | null;
    location: string;
    party?: string | null;
    saleDate: Date;
    houseBirds: number;
    birdsSold: number;
    totalMortality: number;
    totalWeight: string;
    avgWeight: string;
    pricePerKg: string;
    totalAmount: string;
    cashReceived?: string | null;
    depositReceived?: string | null;
    feedConsumed: FeedItem[];
    feedStock: FeedItem[];
    medicineCost?: string | null;
    selectedReportId?: string | null;
    createdAt: Date;
    reports?: SaleReport[];
    cycleName?: string;
    farmerName?: string;
    farmerMobile?: string | null;
    cycle?: {
        name: string;
        doc: number;
        intake: number;
        mortality: number;
        age: number;
        farmer?: { name: string };
    } | null;
    history?: {
        cycleName: string;
        doc: number;
        finalIntake: number;
        mortality: number;
        age: number;
        farmer?: { name: string };
    } | null;
    cycleContext?: {
        doc: number;
        mortality: number;
        age: number;
        feedConsumed: number;
        isEnded: boolean;
        fcr: number;
        epi: number;
        revenue?: number;
        actualRevenue?: number;
        totalWeight?: number;
        cumulativeBirdsSold?: number;
        effectiveRate?: number;
        netAdjustment?: number;
        feedCost?: number;
        docCost?: number;
        profit?: number;
        avgPrice?: number;
    };
    isLatestInCycle?: boolean;
}
