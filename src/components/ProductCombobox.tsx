"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxProduct {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  current_stock: number;
}

interface ProductComboboxProps {
  products: ComboboxProduct[];
  value: string; // product id as string ("" = none)
  onValueChange: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
}

const ProductCombobox = ({
  products,
  value,
  onValueChange,
  placeholder = "Select product",
  triggerClassName,
}: ProductComboboxProps) => {
  const [open, setOpen] = React.useState(false);

  const selectedProduct = products.find((p) => p.id.toString() === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-11 w-full justify-between font-normal",
            !selectedProduct && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">
            {selectedProduct
              ? `${selectedProduct.name} (${selectedProduct.sku}) - Stock: ${selectedProduct.current_stock}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search name, SKU, or barcode..." />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  // cmdk filters on this string, so include every searchable field
                  value={`${product.name} ${product.sku} ${product.barcode ?? ""}`}
                  onSelect={() => {
                    onValueChange(product.id.toString());
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      product.id.toString() === value
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">
                      {product.name}{" "}
                      <span className="text-muted-foreground">
                        ({product.sku})
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Stock: {product.current_stock}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProductCombobox;
