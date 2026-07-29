import QuakeCurrentDashboard from "../features/earthquakes/components/QuakeCurrentDashboard";
import { parseEarthquakeFiltersFromSearchParams } from "../features/earthquakes/model/earthquakes";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const filterSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) filterSearchParams.append(key, item);
    } else if (value !== undefined) {
      filterSearchParams.set(key, value);
    }
  }

  const initialFilters =
    parseEarthquakeFiltersFromSearchParams(filterSearchParams);
  const filterKey = [
    initialFilters.timeWindowHours,
    initialFilters.minimumMagnitude,
    initialFilters.depthBand,
  ].join(":");

  return (
    <QuakeCurrentDashboard
      initialFilters={initialFilters}
      key={filterKey}
    />
  );
}
