"use client";
import { motion } from "framer-motion";
import { Card } from "./card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accent?: boolean;
  index?: number;
}

export function StatCard({ label, value, icon: Icon, trend, accent, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className={cn("p-5", accent && "border-vase-green/30 bg-vase-green-soft/40")}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
            {trend && (
              <p className={cn("mt-1.5 text-xs font-medium", trend.positive ? "text-vase-green" : "text-red-500")}>
                {trend.positive ? "↑" : "↓"} {trend.value}
              </p>
            )}
          </div>
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent ? "bg-vase-green text-white" : "bg-secondary text-muted-foreground")}>
            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
