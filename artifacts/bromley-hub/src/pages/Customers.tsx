import { useRef, useState } from "react";
import { Link } from "wouter";
import { useListCustomers, useCreateCustomer, getListCustomersQueryKey, getGetDashboardQueryKey as getDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusDot } from "@/components/StatusDot";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, ChevronRight, Car, Upload } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  vehicleYear: z.coerce.number().min(1900).max(2100).optional().or(z.literal("").transform(() => undefined)),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  roNumber: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function Customers() {
  const { data: customers, isLoading } = useListCustomers();
  const [filter, setFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ customersCreated: number; partsCreated: number; partsUpdated: number; partsSkipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const createCustomer = useCreateCustomer();
  const { toast } = useToast();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      vehicleYear: undefined,
      vehicleMake: "",
      vehicleModel: "",
      roNumber: "",
      notes: "",
    },
  });

  const onSubmit = (data: CustomerFormValues) => {
    createCustomer.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/import`, { method: "POST", body: formData });
      const result = await res.json();

      if (!res.ok) {
        toast({ title: "Import failed", description: result.error ?? "Unknown error", variant: "destructive" });
      } else {
        setImportResult(result);
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getDashboardQueryKey() });
        toast({
          title: "Spreadsheet imported",
          description: `${result.customersCreated} new customers, ${result.partsCreated} new parts, ${result.partsUpdated} updated.`,
        });
      }
    } catch {
      toast({ title: "Import failed", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredCustomers = customers?.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.roNumber?.toLowerCase().includes(filter.toLowerCase()) ||
    c.vehicleMake?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage active repair jobs and parts.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Import button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
            data-testid="input-import-file"
          />
          <Button
            variant="outline"
            size="lg"
            className="font-semibold gap-2"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-import-spreadsheet"
          >
            <Upload className="h-5 w-5" />
            {isImporting ? "Importing..." : "Import Spreadsheet"}
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="font-semibold shadow-sm" data-testid="button-add-customer">
                <Plus className="mr-2 h-5 w-5" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} data-testid="input-customer-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="vehicleYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="2023" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vehicleMake"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Make</FormLabel>
                          <FormControl>
                            <Input placeholder="Toyota" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vehicleModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="Camry" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="roNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RO Number</FormLabel>
                        <FormControl>
                          <Input placeholder="RO-12345" className="font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any special instructions..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createCustomer.isPending}>
                      {createCustomer.isPending ? "Saving..." : "Save Customer"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg p-4 text-sm text-green-800 dark:text-green-400 flex items-center justify-between">
          <span>
            Import complete — <strong>{importResult.customersCreated}</strong> new customers,{" "}
            <strong>{importResult.partsCreated}</strong> new parts,{" "}
            <strong>{importResult.partsUpdated}</strong> updated,{" "}
            <strong>{importResult.partsSkipped}</strong> unchanged.
          </span>
          <button onClick={() => setImportResult(null)} className="ml-4 text-green-600 hover:text-green-800 font-medium text-xs">
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <div className="p-4 border-b bg-muted/20">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name, vehicle, or RO..."
              className="pl-9 bg-background"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              data-testid="input-filter-customers"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="p-4 flex gap-4 items-center">
                  <div className="w-3 h-3 rounded-full bg-muted animate-pulse" />
                  <div className="h-5 w-48 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredCustomers?.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground">
              <Car className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground mb-1">No customers found</h3>
              <p>Try adjusting your search or add a new customer.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredCustomers?.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/50 transition-colors group gap-4"
                  data-testid={`link-customer-${customer.id}`}
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="mt-1.5 sm:mt-0">
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
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {customer.vehicleYear} {customer.vehicleMake} {customer.vehicleModel}
                        {(!customer.vehicleYear && !customer.vehicleMake) && "No vehicle info"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 ml-7 sm:ml-0">
                    <div className="flex flex-col sm:items-end text-sm">
                      <span className="font-medium">
                        {customer.partsReceived} / {customer.partsTotal} Parts
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Updated {format(new Date(customer.updatedAt), "MMM d")}
                      </span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
