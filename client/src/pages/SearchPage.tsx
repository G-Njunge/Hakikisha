import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { searchMedicines } from "../api/medicines";
import type { MedicineSearchResult } from "../types/medicine";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MedicineSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function runSearch(q: string, targetPage: number) {
    if (!q.trim()) {
      setError("Please enter a medicine name.");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await searchMedicines(q.trim(), targetPage);
      setResult(data);
      setPage(targetPage);
    } catch (err) {
      console.error("Search failed", err);
      setError("Unable to search right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(query, 1);
  }

  return (
    <main className="page-shell">
      <section className="page-card">
        <h1 className="page-title">Search medicines</h1>
        <p className="page-subtitle">
          Can't scan the package? Search the Hakikisha registry by medicine name instead.
        </p>

        <form className="barcode-form" onSubmit={handleSubmit}>
          <input
            className="barcode-input"
            type="text"
            placeholder="e.g. Panadol"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && <p className="page-status error">{error}</p>}

        {!isLoading && hasSearched && !error && result && result.results.length === 0 && (
          <p className="page-status">No medicines matched that search.</p>
        )}

        {result && result.results.length > 0 && (
          <>
            <ul className="result-list">
              {result.results.map((medicine) => (
                <li key={medicine.id}>
                  <Link to={`/medicines/${medicine.id}`} className="search-result-card">
                    <div className="result-top">
                      <span className="result-name">{medicine.name}</span>
                    </div>
                    <div className="result-meta">Generic: {medicine.genericName ?? "Not listed"}</div>
                    <div className="result-meta">Manufacturer: {medicine.manufacturer}</div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="page-nav">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => runSearch(query, page - 1)}
              >
                Previous
              </button>
              <span>
                Page {result.pagination.page} of {result.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= result.pagination.totalPages}
                onClick={() => runSearch(query, page + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}

        <p className="page-link-row">
          <Link to="/barcode">Try scanning instead</Link> · <Link to="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
