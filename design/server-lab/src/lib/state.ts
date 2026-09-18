import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { type BenchRun, type LabStatic, labApi, onBenchDone } from './lab';

export function useLabStatic() {
  return useQuery({
    queryKey: ['lab-static'],
    queryFn: () => labApi<LabStatic>('/state'),
    staleTime: 30_000,
  });
}

export function useBenchRuns() {
  const client = useQueryClient();
  useEffect(
    () =>
      onBenchDone(
        () => void client.invalidateQueries({ queryKey: ['bench-runs'] }),
      ),
    [client],
  );
  return useQuery({
    queryKey: ['bench-runs'],
    queryFn: () => labApi<{ runs: BenchRun[]; running: boolean }>('/bench'),
  });
}

export function useRepositories() {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: () =>
      labApi<{ repositories: { name: string; path: string }[] }>('/repos'),
    staleTime: 60_000,
  });
}

const namesKey = 'lab:show-real-names';
export function realNamesShown() {
  try {
    return localStorage.getItem(namesKey) === '1';
  } catch {
    return false;
  }
}
export function setRealNamesShown(value: boolean) {
  try {
    localStorage.setItem(namesKey, value ? '1' : '0');
  } catch {}
}
