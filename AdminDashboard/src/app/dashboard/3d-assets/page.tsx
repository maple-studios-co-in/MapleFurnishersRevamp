"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Box, Plus, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import ProductWorkspace from "@/components/three-d/ProductWorkspace";
import KeeriImports from "@/components/three-d/KeeriImports";
import { ErrorMessage } from "@/components/three-d/Fields";
import {
  createThreeDProduct,
  fetchThreeDConfig,
  fetchThreeDProducts,
  type ThreeDConfig,
  type ThreeDProduct,
} from "@/lib/three-d-api";

const makeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function ThreeDAssetsPage() {
  const [products, setProducts] = useState<ThreeDProduct[]>([]);
  const [config, setConfig] = useState<ThreeDConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRefresh, setSelectedRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | null>(null);
  const lock = useRef(false);
  const loadRequest = useRef(0);
  const configRequest = useRef(0);
  const productAbort = useRef<AbortController | null>(null);
  const configAbort = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    const request = ++loadRequest.current;
    productAbort.current?.abort();
    const controller = new AbortController();
    productAbort.current = controller;
    setLoading(true);
    setListError(null);
    try {
      const result = await fetchThreeDProducts(controller.signal);
      if (request !== loadRequest.current) return;
      setProducts(result.products);
      setSelectedId((current) =>
        current && result.products.some((product) => product.id === current)
          ? current
          : (result.products[0]?.id ?? null),
      );
    } catch (error) {
      if (request === loadRequest.current)
        setListError(
          error instanceof Error
            ? error.message
            : "3D products could not be loaded.",
        );
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, []);
  const loadConfig = useCallback(async () => {
    const request = ++configRequest.current;
    configAbort.current?.abort();
    const controller = new AbortController();
    configAbort.current = controller;
    setConfigError(null);
    try {
      const next = await fetchThreeDConfig(controller.signal);
      if (request === configRequest.current) setConfig(next);
    } catch (error) {
      if (request !== configRequest.current) return;
      setConfigError(
        error instanceof Error
          ? error.message
          : "Integration status could not be loaded.",
      );
    }
  }, []);
  useEffect(() => {
    void Promise.all([loadProducts(), loadConfig()]);
    return () => {
      loadRequest.current += 1;
      configRequest.current += 1;
      productAbort.current?.abort();
      configAbort.current?.abort();
    };
  }, [loadProducts, loadConfig]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!name.trim()) return setCreateError("Enter a product name.");
    lock.current = true;
    setBusy("create");
    setCreateError(null);
    try {
      const result = await createThreeDProduct({
        name: name.trim(),
        slug: slug.trim(),
      });
      setCreating(false);
      setName("");
      setSlug("");
      setSlugEdited(false);
      await loadProducts();
      setSelectedId(result.product.id);
      toast("success", `Created ${result.product.name} in the 3D workspace.`);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "The product could not be created.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  const refreshImportedProducts = useCallback(async () => {
    await loadProducts();
    setSelectedRefresh(current => current + 1);
  }, [loadProducts]);

  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.slug}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Maple 3D production</h2>
          <p className="mt-1 max-w-2xl text-sm text-admin-text-muted">
            Prepare furniture models, review the customer experience and choose
            the version shown in the Maple customizer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!!busy}
            onClick={() => {
              setCreateError(null);
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add 3D product
          </Button>
        </div>
      </div>
      {configError ? (
        <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
          <p role="alert" className="text-sm text-admin-danger">
            Could not check integration setup: {configError}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadConfig()}
          >
            Retry setup check
          </Button>
        </div>
      ) : config && !config.keeriConfigured ? (
        <div className="glass-card flex items-start gap-3 p-4">
          <Box className="mt-0.5 h-5 w-5 shrink-0 text-admin-accent" />
          <div>
            <p className="text-sm font-semibold">
              Keeri connection is not configured
            </p>
            <p className="mt-1 text-sm text-admin-text-muted">
              You can create a Maple 3D product and upload files now. Ask the
              administrator to connect Keeri before fetching eligible catalogue
              inputs.
            </p>
          </div>
        </div>
      ) : config ? (
        <p className="text-xs text-admin-text-muted">
          Keeri connection configured · Approved catalogue inputs are imported in the background. Maple manages production, files, reviews and publication.
        </p>
      ) : (
        <p role="status" className="text-sm text-admin-text-muted">
          Checking integration setup…
        </p>
      )}
      <KeeriImports enabled={!!config?.keeriConfigured && !configError} onInputsChanged={refreshImportedProducts} onConfigRefresh={loadConfig} />
      <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          className="glass-card min-w-0 space-y-4 p-4"
          aria-label="3D products"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              3D products ({products.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading || !!busy}
              onClick={() => {
                void Promise.all([loadProducts(), loadConfig()]);
                setSelectedRefresh((current) => current + 1);
              }}
              aria-label="Refresh product list"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <Input
            id="three-d-search"
            label="Find product"
            type="search"
            placeholder="Name or address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ErrorMessage message={listError} />
          {listError && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadProducts()}
            >
              Try again
            </Button>
          )}
          {loading && !products.length ? (
            <p role="status" className="py-4 text-sm text-admin-text-muted">
              Loading products…
            </p>
          ) : !visibleProducts.length ? (
            <p className="py-4 text-sm text-admin-text-muted">
              {query
                ? "No products match your search."
                : "No 3D products yet. Add a product or fetch eligible inputs from Keeri."}
            </p>
          ) : (
            <ul className="max-h-[620px] space-y-2 overflow-y-auto">
              {visibleProducts.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(product.id)}
                    aria-pressed={selectedId === product.id}
                    className={`w-full space-y-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-admin-accent ${selectedId === product.id ? "border-admin-accent/50 bg-admin-bg/65" : "border-transparent hover:bg-admin-surface-hover"}`}
                  >
                    <span className="block break-words text-sm font-semibold">
                      {product.name}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          product.publishedVersionId ? "success" : "default"
                        }
                      >
                        {product.publishedVersionId ? "Live" : "Unpublished"}
                      </Badge>
                      <span className="text-xs text-admin-text-muted">
                        {product.sourceType === "keeri"
                          ? "Keeri input"
                          : "Manual"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        {selectedId ? (
          <ProductWorkspace
            key={selectedId}
            productId={selectedId}
            config={config}
            refreshToken={selectedRefresh}
            onListRefresh={loadProducts}
          />
        ) : (
          <div className="glass-card flex min-h-80 flex-col items-center justify-center gap-3 p-8 text-center">
            <Box className="h-10 w-10 text-admin-accent/60" />
            <h3 className="text-lg font-semibold">
              Your furniture’s 3D workspace
            </h3>
            <p className="max-w-sm text-sm text-admin-text-muted">
              Add a product to begin. Upload a model, prepare its materials and
              publish the version you approve.
            </p>
          </div>
        )}
      </div>
      <Modal
        isOpen={creating}
        onClose={() => {
          if (busy !== "create") setCreating(false);
        }}
        title="Add a Maple 3D product"
      >
        <form onSubmit={create} className="space-y-4">
          <p className="text-sm text-admin-text-muted">
            Create a dedicated 3D workspace for this furniture model.
          </p>
          <ErrorMessage message={createError} />
          <Input
            id="three-d-name"
            label="Product name"
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(makeSlug(e.target.value));
            }}
            placeholder="e.g. Taro armchair"
            disabled={busy === "create"}
          />
          <Input
            id="three-d-slug"
            label="Customizer address"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={100}
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
            placeholder="taro-armchair"
            disabled={busy === "create"}
          />
          <p className="break-all text-xs text-admin-text-muted">
            /customize/{slug || "product-name"} · Use lowercase letters, numbers
            and hyphens.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy === "create"}
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={busy === "create"}>
              Create 3D product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
