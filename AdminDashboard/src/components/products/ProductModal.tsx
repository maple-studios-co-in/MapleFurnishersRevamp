"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Input, Textarea, Toggle } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { Product, ProductInput } from "@/lib/api";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductInput) => Promise<void>;
  product?: Product | null;
}

export default function ProductModal({
  isOpen,
  onClose,
  onSubmit,
  product,
}: ProductModalProps) {
  const [formData, setFormData] = useState<ProductInput>({
    name: "",
    slug: "",
    description: "",
    priceCents: 0,
    currency: "USD",
    imageUrl: "",
    category: "seating",
    isPublished: true,
  });
  const [dollars, setDollars] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        slug: product.slug,
        description: product.description,
        priceCents: product.priceCents,
        currency: product.currency,
        imageUrl: product.imageUrl,
        category: product.category,
        isPublished: product.isPublished,
      });
      setDollars((product.priceCents / 100).toString());
    } else {
      setFormData({
        name: "",
        slug: "",
        description: "",
        priceCents: 0,
        currency: "USD",
        imageUrl: "",
        category: "seating",
        isPublished: true,
      });
      setDollars("0");
    }
    setError(null);
  }, [product, isOpen]);

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    setFormData((prev) => ({ ...prev, name, slug: product ? prev.slug : slug }));
  };

  const handlePriceChange = (val: string) => {
    setDollars(val);
    const parsed = parseFloat(val);
    const cents = isNaN(parsed) ? 0 : Math.round(parsed * 100);
    setFormData((prev) => ({ ...prev, priceCents: cents }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug || !formData.imageUrl || !formData.category) {
      setError("Please fill out all required fields.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? "Edit Product" : "Add New Product"}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-admin-danger/20 bg-admin-danger/10 px-4 py-3 text-xs text-admin-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Product Name *"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Maple Dining Chair"
            required
          />
          <Input
            label="Slug *"
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder="e.g. maple-dining-chair"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Price (USD) *"
            type="number"
            step="0.01"
            min="0"
            value={dollars}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="0.00"
            required
          />
          <Input
            label="Category *"
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value.toLowerCase() }))}
            placeholder="e.g. seating, tables, lighting"
            required
          />
        </div>

        <Input
          label="Image URL *"
          value={formData.imageUrl}
          onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
          placeholder="/images/products/maple-chair.webp"
          required
        />

        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Detailed craft craftsmanship story and material details..."
        />

        <div className="pt-2">
          <Toggle
            label="Publish product immediately"
            checked={formData.isPublished ?? true}
            onChange={(checked) => setFormData((prev) => ({ ...prev, isPublished: checked }))}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-admin-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {product ? "Save Changes" : "Create Product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
