import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useSearch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/StatusDot";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, ChevronRight, Car } from "lucide-react";
import { format } from "date-fns";

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query) {
        window.history.replaceState({}, '', `/search?q=${encodeURIComponent(query)}`);
      } else {
        window.history.replaceState({}, '', `/search`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSearch(
    { q: debouncedQuery }, 
    { query: { enabled: debouncedQuery.length > 0 } }
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto space-y-8 mt-8">
        <div className="text-center space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
            <SearchIcon className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Global Search</h1>
          <p className="text-muted-foreground text-lg">
            Find any job by customer name, vehicle, or RO number.
          </p>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon className="h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <Input 
            autoFocus
            placeholder="Start typing to search..." 
            className="pl-14 h-16 text-lg rounded-2xl bg-background border-2 shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="pt-4">
          {!debouncedQuery ? (
            <div className="text-center text-muted-foreground py-12">
              Enter a search term above to find customers and jobs.
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : results && results.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground px-2">
                Found {results.length} result{results.length === 1 ? '' : 's'}
              </h3>
              {results.map((customer) => (
                <Link 
                  key={customer.id} 
                  href={`/customers/${customer.id}`}
                  className="block"
                >
                  <Card className="hover:border-primary/50 transition-colors group">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1.5">
                          <StatusDot status={customer.status} />
                        </div>
                        <div>
                          <div className="font-semibold text-lg text-foreground flex flex-wrap items-center gap-2">
                            {customer.name}
                            {customer.roNumber && (
                              <Badge variant="secondary" className="font-mono font-normal">
                                RO: {customer.roNumber}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            {customer.vehicleYear} {customer.vehicleMake} {customer.vehicleModel}
                            {(!customer.vehicleYear && !customer.vehicleMake) && "No vehicle"}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center bg-muted/20 rounded-2xl py-16 border border-dashed">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
                <SearchIcon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No results found</h3>
              <p className="text-muted-foreground">
                We couldn't find anything matching "{debouncedQuery}".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
