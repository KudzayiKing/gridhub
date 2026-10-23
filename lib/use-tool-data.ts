"use client";

import * as React from "react";
import { listAll, subscribeAll } from "./store";
import { dbAvailable } from "./db";
import type { BaseRecord } from "./types";
import type { DataMap } from "./tools/shared";

/** Loads every local record for one tool, grouped by collection. */
export function useToolData(toolId: string) {
  const [data, setData] = React.useState<DataMap>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;

    const load = () => {
      if (!dbAvailable()) {
        setLoading(false);
        return;
      }
      listAll(toolId)
        .then((all) => {
          if (!alive) return;
          const grouped: DataMap = {};
          for (const row of all) {
            if (row.deleted) continue;
            const list = grouped[row.collection] ?? [];
            list.push(row.data as unknown as BaseRecord);
            grouped[row.collection] = list;
          }
          setData(grouped);
          setLoading(false);
        })
        .catch(() => alive && setLoading(false));
    };

    load();
    const unsub = subscribeAll(load);
    return () => {
      alive = false;
      unsub();
    };
  }, [toolId]);

  return { data, loading };
}
