// Example data for the starter screen. Replace it with the data of the app.
export type Status = "running" | "degraded" | "failed";

export interface Service {
  name: string;
  group: string;
  status: Status;
  image: string;
  cpu: number;
}

export const services: Service[] = [
  { name: "alpha-app", group: "group-a", status: "running", image: "sha-0000001", cpu: 4 },
  {
    name: "beta-app",
    group: "group-b",
    status: "degraded",
    image: "sha-0000002",
    cpu: 61,
  },
  { name: "gamma-app", group: "group-a", status: "failed", image: "v1.4.0", cpu: 0 },
  { name: "delta-app", group: "group-c", status: "running", image: "v2.1.3", cpu: 12 },
];

export const stats = [
  { label: "Requests / min", value: "12,480", change: "+8.2%", good: true },
  { label: "p95 latency", value: "184 ms", change: "+12 ms", good: false },
  { label: "Healthy services", value: "21 / 24", change: "3 need attention", good: true },
];
