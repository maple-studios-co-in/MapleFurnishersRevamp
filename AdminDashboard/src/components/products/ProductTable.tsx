"use client";

import { useState } from "react";
import Image from "next/image";
import { Edit2, Trash2, Eye, EyeOff } from "lucide-react";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { Product } from "@/lib/api";

interface ProductTableProps {
  products: Product[];
  isLoading: boolean;
  onEdit: (product: Product) => void;
  onTogglePublish: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export default function ProductTable({
  products,
  isLoading,
  onEdit,
  onTogglePublish,
  onDelete,
}: ProductTableProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const categories = Array.from(new Set(products.map((p) => p.category)));

  const filteredProducts = products.filter((p) => {
    const matchesCategory = filterCategory === "all" || p.category === filterCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const columns = [
    {
      key: "product",
      header: "Product",
      render: (p: Product) => (
        <div className="flex items-center gap-3.5">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-admin-surface border border-admin-border">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-admin-text-muted">No img</div>
            )}
          </div>
          <div>
            <p className="font-medium text-admin-text">{p.name}</p>
            <p className="text-xs text-admin-text-muted">/{p.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (p: Product) => (
        <span className="capitalize text-admin-text-muted">{p.category}</span>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (p: Product) => (
        <span className="font-semibold text-admin-text">
          ${(p.priceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p: Product) => (
        <Badge variant={p.isPublished ? "success" : "default"}>
          {p.isPublished ? "Published" : "Draft"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (p: Product) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onTogglePublish(p)}
            className="rounded-lg p-2 text-admin-text-muted hover:bg-admin-surface-hover hover:text-admin-text transition-colors"
            title={p.isPublished ? "Unpublish Product" : "Publish Product"}
          >
            {p.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onEdit(p)}
            className="rounded-lg p-2 text-admin-text-muted hover:bg-admin-surface-hover hover:text-admin-accent transition-colors"
            title="Edit Product"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(p)}
            className="rounded-lg p-2 text-admin-text-muted hover:bg-admin-danger/10 hover:text-admin-danger transition-colors"
            title="Delete Product"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Filter products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-admin-border bg-admin-surface px-4 py-2 text-sm text-admin-text outline-none focus:border-admin-accent/50"
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-admin-text-muted">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text outline-none focus:border-admin-accent/50"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Table
        columns={columns}
        data={filteredProducts}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        emptyMessage="No products match your filter parameters."
      />
    </div>
  );
}
