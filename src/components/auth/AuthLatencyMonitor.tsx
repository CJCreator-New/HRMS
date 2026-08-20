"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

export interface LoginAttemptMetric {
  id: string;
  attemptNumber: number;
  timestamp: string;
  durationMs: number;
  status: "success" | "error";
  errorClassification?: string;
  account?: string;
}

interface AuthLatencyMonitorProps {
  attempts: LoginAttemptMetric[];
  onClearHistory?: () => void;
}

export function AuthLatencyMonitor({ attempts, onClearHistory }: AuthLatencyMonitorProps) {
  // Take last 10 attempts
  const recentAttempts = useMemo(() => {
    return attempts.slice(-10).map((a, index) => ({
      ...a,
      displayIndex: `#${index + 1}`,
      formattedTime: new Date(a.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    }));
  }, [attempts]);

  const stats = useMemo(() => {
    if (recentAttempts.length === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        latest: 0,
        trend: "idle" as const,
        trendDescription: "Awaiting login handshakes...",
      };
    }

    const durations = recentAttempts.map((a) => a.durationMs);
    const count = durations.length;
    const latest = durations[count - 1];
    const sum = durations.reduce((acc, v) => acc + v, 0);
    const avg = Math.round(sum / count);
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    // Analyze trend over the window
    let trend: "increasing" | "decreasing" | "stable" | "intermittent" = "stable";
    let trendDescription = "Latency response is uniform and stable.";

    if (count >= 3) {
      const variance = Math.sqrt(
        durations.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count
      );
      const isSpiky = variance > avg * 0.45;

      const firstHalf = durations.slice(0, Math.floor(count / 2));
      const secondHalf = durations.slice(Math.floor(count / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (isSpiky) {
        trend = "intermittent";
        trendDescription = "Intermittent latency detected (jitter observed across attempts).";
      } else if (secondAvg > firstAvg * 1.3) {
        trend = "increasing";
        trendDescription = "Authentication delay is increasing over consecutive attempts.";
      } else if (secondAvg < firstAvg * 0.7) {
        trend = "decreasing";
        trendDescription = "Latency is decreasing and stabilizing.";
      } else {
        trend = "stable";
        trendDescription = "Authentication delay is within expected baseline variance.";
      }
    }

    return { count, avg, min, max, latest, trend, trendDescription };
  }, [recentAttempts]);

  if (recentAttempts.length === 0) {
    return (
      <div className="p-3 bg-surface-muted/60 rounded-xl border border-line text-xs space-y-1.5 text-center">
        <div className="flex items-center justify-center gap-1.5 font-semibold text-ink-secondary">
          <Activity className="w-3.5 h-3.5 text-primary-600" />
          <span>Handshake Latency Monitor</span>
        </div>
        <p className="text-[11px] text-ink-muted">
          Tracks the duration of the last 10 login attempts to identify intermittent spikes or increasing authentication delay.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="auth-latency-monitor"
      className="p-3.5 bg-surface-muted rounded-xl border border-line text-xs space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-ink">
          <Activity className="w-4 h-4 text-primary-600" />
          <span>Authentication Latency Monitor</span>
          <span className="text-[10px] font-normal text-ink-muted">
            (Last {recentAttempts.length} attempt{recentAttempts.length > 1 ? "s" : ""})
          </span>
        </div>

        {onClearHistory && (
          <button
            type="button"
            onClick={onClearHistory}
            className="flex items-center gap-1 text-[10px] text-ink-muted hover:text-ink transition cursor-pointer"
            title="Clear latency log"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Latency KPI Badges */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="bg-white p-1.5 rounded-lg border border-line">
          <div className="text-[10px] text-ink-muted">Latest</div>
          <div className="font-bold text-ink text-xs font-mono">{stats.latest}ms</div>
        </div>
        <div className="bg-white p-1.5 rounded-lg border border-line">
          <div className="text-[10px] text-ink-muted">Average</div>
          <div className="font-bold text-primary-700 text-xs font-mono">{stats.avg}ms</div>
        </div>
        <div className="bg-white p-1.5 rounded-lg border border-line">
          <div className="text-[10px] text-ink-muted">Min</div>
          <div className="font-bold text-emerald-700 text-xs font-mono">{stats.min}ms</div>
        </div>
        <div className="bg-white p-1.5 rounded-lg border border-line">
          <div className="text-[10px] text-ink-muted">Max</div>
          <div className="font-bold text-amber-700 text-xs font-mono">{stats.max}ms</div>
        </div>
      </div>

      {/* Recharts Latency Chart */}
      <div className="w-full h-32 bg-white rounded-lg border border-line p-1 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={recentAttempts} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="authLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="displayIndex"
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              unit="ms"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as LoginAttemptMetric & { formattedTime: string };
                  const isSuccess = data.status === "success";
                  return (
                    <div className="bg-ink text-white p-2 rounded shadow-lg text-[11px] space-y-1 z-50">
                      <div className="font-bold flex items-center gap-1">
                        {isSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span>Attempt {data.attemptNumber}</span>
                        <span className="text-white/60 font-mono text-[10px]">({data.formattedTime})</span>
                      </div>
                      <div className="font-mono text-emerald-300">
                        Duration: <span className="font-bold">{data.durationMs}ms</span>
                      </div>
                      {data.account && <div className="text-white/80 truncate">User: {data.account}</div>}
                      {data.errorClassification && (
                        <div className="text-red-300 text-[10px]">Type: {data.errorClassification}</div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={stats.avg} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `Avg ${stats.avg}ms`, fill: "#64748b", fontSize: 9, position: "insideTopRight" }} />
            <Area
              type="monotone"
              dataKey="durationMs"
              stroke="#4f46e5"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#authLatencyGrad)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const isErr = payload.status === "error";
                return (
                  <circle
                    key={`dot-${payload.id}`}
                    cx={cx}
                    cy={cy}
                    r={3.5}
                    fill={isErr ? "#ef4444" : "#4f46e5"}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trend Diagnostics Notice */}
      <div className="flex items-start gap-2 p-2 rounded-lg bg-white border border-line text-[11px]">
        {stats.trend === "increasing" ? (
          <TrendingUp className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        ) : stats.trend === "decreasing" ? (
          <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        ) : stats.trend === "intermittent" ? (
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
        )}
        <div className="leading-tight">
          <span className="font-semibold text-ink">Trend Assessment: </span>
          <span className="text-ink-secondary">{stats.trendDescription}</span>
        </div>
      </div>
    </div>
  );
}
