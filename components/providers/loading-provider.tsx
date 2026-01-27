"use client";

import { Bird } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

interface LoadingContextType {
    showLoading: (message?: string) => void;
    hideLoading: () => void;
    isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider = ({ children }: { children: React.ReactNode }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | undefined>();
    const pathname = usePathname();

    useEffect(() => {
        // Automatically hide loading when pathname changes (navigation complete)
        hideLoading();
    }, [pathname]);

    const showLoading = (msg?: string) => {
        setMessage(msg);
        setIsLoading(true);
    };

    const hideLoading = () => {
        setIsLoading(false);
        setMessage(undefined);
    };

    return (
        <LoadingContext.Provider value={{ showLoading, hideLoading, isLoading }}>
            {children}
            {isLoading && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute size-20 bg-primary/20 rounded-full animate-ping opacity-75" />
                            <div className="relative bg-white p-5 rounded-full shadow-2xl border border-slate-100 ring-4 ring-slate-50">
                                <Bird className="size-10 text-primary animate-pulse" />
                            </div>
                        </div>
                        {message && (
                            <div className="flex flex-col items-center gap-1 animate-in slide-in-from-bottom-2 duration-500 delay-100">
                                <p className="text-sm font-bold text-slate-800 tracking-widest uppercase">
                                    {message}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">Please wait a moment...</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error("useLoading must be used within a LoadingProvider");
    }
    return context;
};
