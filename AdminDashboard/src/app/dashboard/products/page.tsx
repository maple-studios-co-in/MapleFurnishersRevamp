"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import ProductTable from "@/components/products/ProductTable";
import ProductModal from "@/components/products/ProductModal";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/hooks/useApi";
import {
  fetchAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type ProductInput,
} from "@/lib/api";

export default function ProductsPage() {
  const { data, isLoading, refetch } = useApi(fetchAllProducts);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateOrUpdate = async (input: ProductInput) => {
    try {
      if (selectedProduct) {
        await updateProduct(selectedProduct.id, input);
        toast("success", `Updated product "${input.name}" successfully.`);
      } else {
        await createProduct(input);
        toast("success", `Created product "${input.name}" successfully.`);
      }
      refetch();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to save product.");
      throw err;
    }
  };

  const handleTogglePublish = async (p: Product) => {
    try {
      await updateProduct(p.id, { isPublished: !p.isPublished });
      toast("info", `Product "${p.name}" is now ${!p.isPublished ? "published" : "draft"}.`);
      refetch();
    } catch (err) {
      toast("error", "Failed to update product status.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      await deleteProduct(deletingProduct.id);
      toast("success", `Deleted product "${deletingProduct.name}".`);
      setDeletingProduct(null);
      refetch();
    } catch (err) {
      toast("error", "Failed to delete product.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-admin-text">Catalogue Management</h2>
          <p className="text-xs text-admin-text-muted">Create, update and manage furniture products visible on the website.</p>
        </div>

        <Button
          onClick={() => {
            setSelectedProduct(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add New Product
        </Button>
      </div>

      <ProductTable
        products={data?.products ?? []}
        isLoading={isLoading}
        onEdit={(p) => {
          setSelectedProduct(p);
          setIsModalOpen(true);
        }}
        onTogglePublish={handleTogglePublish}
        onDelete={(p) => setDeletingProduct(p)}
      />

      {/* Add / Edit Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        product={selectedProduct}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        title="Confirm Deletion"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-admin-text-muted">
            Are you sure you want to delete product <strong className="text-admin-text">{deletingProduct?.name}</strong>? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setDeletingProduct(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={isDeleting} onClick={handleDeleteConfirm}>
              Delete Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
