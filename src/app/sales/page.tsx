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
import { toast } from "sonner";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import dayjs from "dayjs";

interface SaleItem {
  product: {
    name: string;
  };
  quantity: number;
  price: number;
}

interface Sale {
  id: number;
  totalAmount: number;
  soldAt: string;
  items: SaleItem[];
  soldBy?: number;
}

const SalesReportPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await api.get("/sales");
        setSales(res.data);
      } catch (error) {
        toast.error("Failed to fetch sales");
      }
    };

    fetchSales();
  }, []);

  // filter + sort logic
  const filteredSales = useMemo(() => {
    let filtered = sales;

    if (search) {
      filtered = filtered.filter((sale) =>
        sale.items.some((item) =>
          item.product.name.toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(
        (sale) => new Date(sale.soldAt).getTime() >= dateFrom.getTime()
      );
    }

    if (dateTo) {
      filtered = filtered.filter(
        (sale) => new Date(sale.soldAt).getTime() <= dateTo.getTime()
      );
    }

    if (sortBy === "date_asc") {
      filtered = [...filtered].sort(
        (a, b) => new Date(a.soldAt).getTime() - new Date(b.soldAt).getTime()
      );
    } else if (sortBy === "date_desc") {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime()
      );
    } else if (sortBy === "amount_asc") {
      filtered = [...filtered].sort((a, b) => a.totalAmount - b.totalAmount);
    } else if (sortBy === "amount_desc") {
      filtered = [...filtered].sort((a, b) => b.totalAmount - a.totalAmount);
    }

    return filtered;
  }, [sales, search, sortBy, dateFrom, dateTo]);

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Sales Report</h1>

        {/* Filter + Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by product..."
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
          <p>No sales records found.</p>
        ) : (
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) =>
                  sale.items.map((item, idx) => (
                    <TableRow key={`${sale.id}-${idx}`}>
                      <TableCell>{sale.id}</TableCell>
                      <TableCell>
                        {dayjs(sale.soldAt).format("MMM D, YYYY h:mm A")}
                      </TableCell>
                      <TableCell>{item.product.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        ₱
                        {item.price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        ₱
                        {(item.price * item.quantity).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default SalesReportPage;
