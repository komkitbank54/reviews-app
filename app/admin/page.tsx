"use client";

import { useEffect, useMemo, useState } from "react";

type Platform = "tiktok" | "youtube" | "reels";

type ReviewItem = {
  _id?: string;
  title: string;
  platform: Platform;
  productImage?: string;
  productGif?: string;
  price?: string;
  rating?: number;
  tags: string[];
  aliases?: string[];
  publishedAt: string; // ISO
  reviewUrl: string;
  affiliateUrl?: string;
  pros?: string[];
  cons?: string[];
};

const emptyItem: ReviewItem = {
  title: "",
  platform: "tiktok",
  productImage: "",
  productGif: "",
  price: "",
  rating: undefined,
  tags: [],
  aliases: [],
  publishedAt: new Date().toISOString(),
  reviewUrl: "",
  affiliateUrl: "",
  pros: [],
  cons: [],
};

export default function AdminDashboard() {
  type FieldErrs = Partial<Record<keyof ReviewItem, string>>;
  const [errs, setErrs] = useState<FieldErrs>({});
  const [formErr, setFormErr] = useState<string>("");

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReviewItem>(emptyItem);
  const [filter, setFilter] = useState("");

  // string inputs (ค่อย split ตอน save)
  const [tagsInput, setTagsInput] = useState("");
  const [aliasesInput, setAliasesInput] = useState("");
  const [prosInput, setProsInput] = useState("");
  const [consInput, setConsInput] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/reviews?limit=300", { cache: "no-store" });
    const json = await res.json();
    setItems(json.data || []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.tags?.some((t) => t.toLowerCase().includes(q)) ||
        it.reviewUrl.toLowerCase().includes(q)
    );
  }, [items, filter]);

  const isEditing = !!editing._id;

  async function saveItem() {
    setErrs({});
    setFormErr("");

    const withLists: ReviewItem = {
      ...editing,
      tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
      aliases: aliasesInput.split(",").map((s) => s.trim()).filter(Boolean),
      pros: prosInput.split(",").map((s) => s.trim()).filter(Boolean),
      cons: consInput.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const body = normalizeForApi(withLists);

    const url = isEditing ? `/api/reviews/${editing._id}` : "/api/reviews";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // ❌ ไม่รีเซ็ตฟอร์ม
      if (res.status === 400) {
        try {
          const json = await res.json();
          const fe = json?.issues?.fieldErrors as Record<string, string[]>;
          if (fe) {
            const mapped: FieldErrs = {};
            Object.entries(fe).forEach(([k, arr]) => {
              if (Array.isArray(arr) && arr.length)
                mapped[k as keyof ReviewItem] = arr[0];
            });
            setErrs(mapped);
          } else {
            setFormErr(json?.error || "Invalid data");
          }
        } catch {
          setFormErr("Invalid data");
        }
      } else if (res.status === 401) {
        setFormErr("Unauthorized: โปรดล็อกอินใหม่");
      } else {
        setFormErr(`Error ${res.status}`);
      }
      return;
    }

    // ✅ สำเร็จ
    await load();
    setEditing(emptyItem);
    setTagsInput("");
    setAliasesInput("");
    setProsInput("");
    setConsInput("");
    setErrs({});
    setFormErr("");
  }

  async function removeItem(id?: string) {
    if (!id) return;
    if (!confirm("ลบรายการนี้?")) return;
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    await load();
  }

  // ---- media helpers ----
  const MEDIA = (
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.ikk.ist"
  ).replace(/\/+$/, "");

  function joinMedia(v?: string) {
    if (!v) return "";
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
    const path = v.startsWith("/") ? v : `/${v}`;
    return `${MEDIA}${path}`;
  }

  function stripMedia(u?: string) {
    if (!u) return "";
    try {
      return u.startsWith(MEDIA) ? u.slice(MEDIA.length) || "/" : u;
    } catch {
      return u;
    }
  }

  function normalizeForApi(it: ReviewItem) {
    return {
      ...it,
      productImage: joinMedia(it.productImage),
      productGif: joinMedia(it.productGif),
      rating:
        it.rating === undefined || it.rating === null ? "" : String(it.rating),
      tags: (it.tags || []).filter(Boolean),
      aliases: (it.aliases || []).filter(Boolean),
      pros: (it.pros || []).filter(Boolean),
      cons: (it.cons || []).filter(Boolean),
    };
  }

  function editFromRow(row: any) {
    setEditing({
      ...row,
      productImage: stripMedia(row.productImage),
      productGif: stripMedia(row.productGif),
      publishedAt: new Date(row.publishedAt).toISOString(),
    });
    setTagsInput((row.tags || []).join(","));
    setAliasesInput((row.aliases || []).join(","));
    setProsInput((row.pros || []).join(","));
    setConsInput((row.cons || []).join(","));
    setErrs({});
    setFormErr("");
  }

  return (
    <div className="min-h-dvh px-4 md:px-6 py-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl md:text-2xl font-semibold text-[var(--text-primary)]">
          Admin Dashboard
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <form action="/api/admin/logout" method="post">
            <button className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 flex items-center gap-2">
            <input
              className="flex-1 bg-transparent outline-none px-3 py-2 rounded-lg border border-white/10"
              placeholder="ค้นหาชื่อ / แท็ก / ลิงก์รีวิว"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button
              onClick={() => {
                setEditing(emptyItem);
                setTagsInput("");
                setAliasesInput("");
                setProsInput("");
                setConsInput("");
                setErrs({});
                setFormErr("");
              }}
              className="h-10 px-4 rounded-xl bg-emerald-600/90 hover:bg-emerald-600"
            >
              + เพิ่มใหม่
            </button>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/70">
                <tr>
                  <th className="text-left p-2">ชื่อ</th>
                  <th className="text-left p-2">แพลตฟอร์ม</th>
                  <th className="text-left p-2">วันที่</th>
                  <th className="text-left p-2">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-zinc-400">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-zinc-400">
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  filtered.map((it) => (
                    <tr key={it._id} className="odd:bg-zinc-900/30">
                      <td className="p-2">{it.title}</td>
                      <td className="p-2">{it.platform}</td>
                      <td className="p-2">
                        {new Date(it.publishedAt).toLocaleDateString()}
                      </td>
                      <td className="p-2 flex gap-2">
                        <button
                          className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700"
                          onClick={() => editFromRow(it)}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="px-3 py-1 rounded-lg bg-red-600/80 hover:bg-red-600"
                          onClick={() => removeItem(it._id)}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold mb-3">
              {isEditing ? "แก้ไขรีวิว" : "เพิ่มรีวิว"}
            </h2>

            <div className="grid grid-cols-1 gap-3">
              <input
                className={`inp ${errs.title ? "border-red-500" : ""}`}
                placeholder="ชื่อเรื่อง"
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
              {errs.title && (
                <p className="text-xs text-red-400">{errs.title}</p>
              )}

              <div className="grid grid-cols-3 gap-2">
                {(["tiktok", "youtube", "reels"] as const).map((p) => (
                  <button
                    key={p}
                    className={`h-10 rounded-lg border ${
                      editing.platform === p ? "bg-emerald-600/80" : "bg-zinc-800"
                    }`}
                    onClick={() => setEditing({ ...editing, platform: p })}
                    type="button"
                  >
                    {p}
                  </button>
                ))}
              </div>

              <input
                className={`inp ${errs.productImage ? "border-red-500" : ""}`}
                placeholder="พาธรูป (เช่น /img/a.png)"
                value={editing.productImage || ""}
                onChange={(e) =>
                  setEditing({ ...editing, productImage: e.target.value })
                }
              />
              {errs.productImage && (
                <p className="text-xs text-red-400">{errs.productImage}</p>
              )}

              <input
                className={`inp ${errs.productGif ? "border-red-500" : ""}`}
                placeholder="พาธ GIF (เช่น /gif/a.gif)"
                value={editing.productGif || ""}
                onChange={(e) =>
                  setEditing({ ...editing, productGif: e.target.value })
                }
              />
              {errs.productGif && (
                <p className="text-xs text-red-400">{errs.productGif}</p>
              )}

              <input
                className="inp"
                placeholder="ราคา (ตัวหนังสือ)"
                value={editing.price || ""}
                onChange={(e) =>
                  setEditing({ ...editing, price: e.target.value })
                }
              />

              <input
                type="number"
                step="0.1"
                className={`inp ${errs.rating ? "border-red-500" : ""}`}
                placeholder="เรต 0..5"
                value={editing.rating ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    rating:
                      e.target.value === ""
                        ? undefined
                        : parseFloat(e.target.value),
                  })
                }
              />
              {errs.rating && (
                <p className="text-xs text-red-400">{errs.rating}</p>
              )}

              <input
                className="inp"
                placeholder="แท็ก (คั่นด้วย , )"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
              <input
                className="inp"
                placeholder="aliases (คั่นด้วย , )"
                value={aliasesInput}
                onChange={(e) => setAliasesInput(e.target.value)}
              />

              <input
                className={`inp ${errs.reviewUrl ? "border-red-500" : ""}`}
                placeholder="ลิงก์รีวิว (TikTok/YouTube) - ต้องเป็น https://"
                value={editing.reviewUrl}
                onChange={(e) =>
                  setEditing({ ...editing, reviewUrl: e.target.value })
                }
              />
              {errs.reviewUrl && (
                <p className="text-xs text-red-400">{errs.reviewUrl}</p>
              )}

              <input
                className="inp"
                type="datetime-local"
                value={toLocalInput(editing.publishedAt)}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    publishedAt: new Date(e.target.value).toISOString(),
                  })
                }
              />

              <input
                className="inp"
                placeholder="ลิงก์ร้าน/affiliate (ถ้ามี)"
                value={editing.affiliateUrl || ""}
                onChange={(e) =>
                  setEditing({ ...editing, affiliateUrl: e.target.value })
                }
              />

              <input
                className="inp"
                placeholder="ข้อดี (คั่นด้วย , ) เช่น: ประกอบง่าย,วัสดุดี,ราคาถูก"
                value={prosInput}
                onChange={(e) => setProsInput(e.target.value)}
              />
              <input
                className="inp"
                placeholder="ข้อเสีย (คั่นด้วย , ) เช่น: สีลอกง่าย,เสียงดัง"
                value={consInput}
                onChange={(e) => setConsInput(e.target.value)}
              />

              <div className="flex gap-2">
                <button
                  className="h-11 flex-1 rounded-xl bg-emerald-600/90 hover:bg-emerald-600"
                  onClick={saveItem}
                  type="button"
                >
                  {isEditing ? "บันทึกการแก้ไข" : "เพิ่มรีวิว"}
                </button>
                {isEditing && (
                  <button
                    className="h-11 px-4 rounded-xl bg-zinc-700 hover:bg-zinc-600"
                    type="button"
                    onClick={() => {
                      setEditing(emptyItem);
                      setTagsInput("");
                      setAliasesInput("");
                      setProsInput("");
                      setConsInput("");
                      setErrs({});
                      setFormErr("");
                    }}
                  >
                    ยกเลิก
                  </button>
                )}
              </div>

              {formErr && (
                <p className="text-sm text-red-400 mt-1">{formErr}</p>
              )}

              <p className="text-xs text-zinc-400">
                ** รูป/ GIF กรุณาอัปโหลดไฟล์ไปที่ MiniPC เอง:
                <br />
                รูป → <code>C:\media\img\</code> | GIF →{" "}
                <code>C:\media\gif\</code> แล้วใส่พาธเช่น{" "}
                <code>/img/ชื่อไฟล์.png</code>, <code>/gif/ชื่อไฟล์.gif</code>
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .inp {
          background: rgba(9, 9, 11, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          outline: none;
          padding: 0.6rem 0.75rem;
          border-radius: 0.75rem;
        }
        .inp:focus {
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
        }
      `}</style>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
