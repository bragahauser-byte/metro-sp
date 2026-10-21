"use client";

import { useEffect, useState } from "react";
import type { OpsSnapshot } from "@/lib/ops/types";

export type OpsState = { status: "loading" } | { status: "ok"; data: OpsSnapshot } | { status: "error" };

// Uma leitura por visita: todos os componentes dividem a mesma promessa.
let pending: Promise<OpsSnapshot> | null = null;

function load(): Promise<OpsSnapshot> {
  pending ??= fetch("/api/avisos")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<OpsSnapshot>;
    })
    .catch((e) => {
      pending = null; // deixa tentar de novo depois
      throw e;
    });
  return pending;
}

export function useOps(enabled = true): OpsState & { retry: () => void } {
  const [state, setState] = useState<OpsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load().then(
      (data) => alive && setState({ status: "ok", data }),
      () => alive && setState({ status: "error" }),
    );
    return () => {
      alive = false;
    };
  }, [enabled, attempt]);
  return {
    ...state,
    retry: () => {
      setState({ status: "loading" });
      setAttempt((n) => n + 1);
    },
  };
}
