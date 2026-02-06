"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import dayjs from "dayjs";
import { ChevronRight, Package, Tag } from "lucide-react";

interface Discount {
  id: number;
  name: string;
  type: string;
  value: number;
}

interface SaleItem {
  product: {
    id?: number;
    name: string;
  };
  quantity: number;
  price: number;
  discountedPrice?: number | null;
  discountAmount?: number;
  discount?: Discount | null;
}

interface Seller {
  id: number;
  name: string;
  email: string;
}

interface Sale {
  id: number;
  subtotal?: number;
  totalDiscount?: number;
  totalAmount: number;
  cashAmount?: number;
  changeAmount?: number;
  soldAt: string;
  soldBy: string | number;
  seller?: Seller | null;
  items: SaleItem[];
}

const SalesReportPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        const res = await api.get("/sales");
        
        // Transform data to ensure numbers
        const transformedSales = res.data.map((sale: any) => ({
          ...sale,
          subtotal: sale.subtotal ? Number(sale.subtotal) : null,
          totalDiscount: sale.totalDiscount ? Number(sale.totalDiscount) : 0,
          totalAmount: Number(sale.totalAmount),
          cashAmount: sale.cashAmount ? Number(sale.cashAmount) : null,
          changeAmount: sale.changeAmount ? Number(sale.changeAmount) : null,
          items: sale.items.map((item: any) => ({
            ...item,
            price: Number(item.price),
            quantity: Number(item.quantity),
            discountedPrice: item.discountedPrice ? Number(item.discountedPrice) : null,
            discountAmount: item.discountAmount ? Number(item.discountAmount) : 0,
          })),
        }));
        
        setSales(transformedSales);
      } catch (error) {
        console.error("Fetch sales error:", error);
        toast.error("Failed to fetch sales");
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  // Filter + sort logic
  const filteredSales = useMemo(() => {
    let filtered = sales;

    if (search) {
      filtered = filtered.filter(
        (sale) =>
          sale.id.toString().includes(search) ||
          sale.items.some((item) =>
            item.product?.name?.toLowerCase().includes(search.toLowerCase()),
          ) ||
          sale.seller?.name?.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(
        (sale) => new Date(sale.soldAt).getTime() >= dateFrom.getTime(),
      );
    }

    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (sale) => new Date(sale.soldAt).getTime() <= endOfDay.getTime(),
      );
    }

    if (sortBy === "date_asc") {
      filtered = [...filtered].sort(
        (a, b) => new Date(a.soldAt).getTime() - new Date(b.soldAt).getTime(),
      );
    } else if (sortBy === "date_desc") {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
      );
    } else if (sortBy === "amount_asc") {
      filtered = [...filtered].sort((a, b) => a.totalAmount - b.totalAmount);
    } else if (sortBy === "amount_desc") {
      filtered = [...filtered].sort((a, b) => b.totalAmount - a.totalAmount);
    }

    return filtered;
  }, [sales, search, sortBy, dateFrom, dateTo]);

  const handleRowClick = (sale: Sale) => {
    setSelectedSale(sale);
    setDialogOpen(true);
  };

  const getProductSummary = (items: SaleItem[]) => {
    if (items.length === 0) return "No items";
    if (items.length === 1) {
      return items[0].product?.name || "Unknown product";
    }
    return `${items[0].product?.name || "Unknown"} +${items.length - 1} more`;
  };

  const getTotalItems = (items: SaleItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const getItemSubtotal = (item: SaleItem) => {
    const price = item.discountedPrice ?? item.price ?? 0;
    return price * (item.quantity || 0);
  };

  const hasDiscounts = (sale: Sale) => {
    return sale.items.some(item => item.discount || item.discountedPrice);
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalRevenue = filteredSales.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0,
    );
    const totalDiscount = filteredSales.reduce(
      (sum, sale) => sum + (sale.totalDiscount || 0),
      0,
    );
    const totalTransactions = filteredSales.length;
    const totalItems = filteredSales.reduce(
      (sum, sale) => sum + getTotalItems(sale.items),
      0,
    );
    const avgTransaction =
      totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return { totalRevenue, totalDiscount, totalTransactions, totalItems, avgTransaction };
  }, [filteredSales]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <p>Loading sales data...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Sales Report</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">
              ₱{summaryStats.totalRevenue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total Discounts</p>
            <p className="text-2xl font-bold text-green-600">
              ₱{summaryStats.totalDiscount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold">
              {summaryStats.totalTransactions}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Items Sold</p>
            <p className="text-2xl font-bold">{summaryStats.totalItems}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Avg Transaction</p>
            <p className="text-2xl font-bold">
              ₱{summaryStats.avgTransaction.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </Card>
        </div>

        {/* Filter + Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by ID, product, or seller..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />

          {/* From Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[140px] justify-start text-left font-normal"
              >
                {dateFrom ? dayjs(dateFrom).format("MMM D, YYYY") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
              />
            </PopoverContent>
          </Popover>

          {/* To Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[140px] justify-start text-left font-normal"
              >
                {dateTo ? dayjs(dateTo).format("MMM D, YYYY") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
            </PopoverContent>
          </Popover>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Date (Newest first)</SelectItem>
              <SelectItem value="date_asc">Date (Oldest first)</SelectItem>
              <SelectItem value="amount_desc">Amount (High → Low)</SelectItem>
              <SelectItem value="amount_asc">Amount (Low → High)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setSortBy("date_desc");
              setDateFrom(undefined);
              setDateTo(undefined);
            }}
          >
            Reset
          </Button>
        </div>

        {/* Table */}
        {filteredSales.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No sales records found.</p>
          </Card>
        ) : (
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Sold By</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(sale)}
                  >
                    <TableCell className="font-medium">#{sale.id}</TableCell>
                    <TableCell>
                      {dayjs(sale.soldAt).format("MMM D, YYYY h:mm A")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getProductSummary(sale.items)}
                        {sale.items.length > 1 && (
                          <Badge variant="secondary">
                            {sale.items.length} items
                          </Badge>
                        )}
                        {hasDiscounts(sale) && (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            <Tag className="h-3 w-3 mr-1" />
                            Discount
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTotalItems(sale.items)}</TableCell>
                    <TableCell className="font-semibold">
                      ₱{(sale.totalAmount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>{sale.seller?.name || sale.soldBy}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Transaction Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>
                Transaction #{selectedSale?.id} •{" "}
                {selectedSale &&
                  dayjs(selectedSale.soldAt).format("MMM D, YYYY h:mm A")}
              </DialogDescription>
            </DialogHeader>

            {selectedSale && (
              <div className="space-y-4">
                {/* Transaction Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Sold By</p>
                    <p className="font-medium">
                      {selectedSale.seller?.name || selectedSale.soldBy}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                    <p className="font-medium">
                      {getTotalItems(selectedSale.items)}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h3 className="font-semibold mb-2">Items</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items.map((item, idx) => (
                        <React.Fragment key={idx}>
                          <TableRow>
                            <TableCell>
                              {item.product?.name || "Unknown product"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.discountedPrice ? (
                                <div>
                                  <span className="line-through text-muted-foreground text-sm">
                                    ₱{(item.price || 0).toFixed(2)}
                                  </span>
                                  <br />
                                  <span className="text-green-600 font-semibold">
                                    ₱{item.discountedPrice.toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                `₱${(item.price || 0).toFixed(2)}`
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              ₱{getItemSubtotal(item).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                          </TableRow>
                          {item.discount && (
                            <TableRow className="bg-green-50/50">
                              <TableCell colSpan={4} className="text-xs text-green-700 py-1">
                                <Tag className="h-3 w-3 inline mr-1" />
                                {item.discount.name} applied
                                {item.discountAmount && item.discountAmount > 0 && (
                                  <span className="ml-2">
                                    (Saved: ₱{item.discountAmount.toFixed(2)})
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Total Summary */}
                <div className="space-y-2">
                  {selectedSale.subtotal && selectedSale.subtotal > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>₱{selectedSale.subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedSale.totalDiscount && selectedSale.totalDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600">
                      <span>Total Discount:</span>
                      <span>-₱{selectedSale.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                    <p className="font-semibold text-lg">Total Amount</p>
                    <p className="font-bold text-2xl">
                      ₱{(selectedSale.totalAmount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  {selectedSale.cashAmount && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Cash:</span>
                        <span>₱{selectedSale.cashAmount.toFixed(2)}</span>
                      </div>
                      {selectedSale.changeAmount !== null && selectedSale.changeAmount !== undefined && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Change:</span>
                          <span>₱{selectedSale.changeAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
};

export default SalesReportPage;