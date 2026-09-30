import { ClientApp } from "@/components/ClientApp";

// The page shell is a Server Component; everything that touches WebGPU,
// workers or browser storage lives below the ClientApp boundary.
export default function Home() {
  return <ClientApp />;
}
