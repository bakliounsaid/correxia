import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getCurrentTeacher, safeStorageName, uploadToTestsBucket } from "@/lib/storage-upload";

function fakeSupabase(opts: { user?: { id: string } | null; teacher?: unknown; uploadError?: string }) {
  const upload = vi.fn().mockResolvedValue({ error: opts.uploadError ? { message: opts.uploadError } : null });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null } }) },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: opts.teacher ?? null }) }) }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      })),
    },
  };
  return { client: client as unknown as SupabaseClient, upload };
}

describe("safeStorageName", () => {
  it("remplace les caractères non sûrs et met en minuscules", () => {
    expect(safeStorageName("Copie Élève #1.PNG")).toBe("copie--l-ve--1.png");
  });
});

describe("getCurrentTeacher", () => {
  it("renvoie le profil enseignant", async () => {
    const { client } = fakeSupabase({ user: { id: "u1" }, teacher: { id: "t1", school_id: null } });
    await expect(getCurrentTeacher(client)).resolves.toEqual({ id: "t1", school_id: null });
  });

  it("explique l'erreur sans session ou sans profil", async () => {
    await expect(getCurrentTeacher(fakeSupabase({ user: null }).client)).rejects.toThrow("Session expirée");
    await expect(getCurrentTeacher(fakeSupabase({ user: { id: "u1" } }).client)).rejects.toThrow(
      "Profil enseignant introuvable",
    );
  });
});

describe("uploadToTestsBucket", () => {
  it("envoie le fichier sans écraser l'existant et renvoie l'URL publique", async () => {
    const { client, upload } = fakeSupabase({});
    const url = await uploadToTestsBucket(client, "t1/a.png", new Blob(["x"]), "image/png");
    expect(url).toBe("https://cdn.test/t1/a.png");
    expect(upload).toHaveBeenCalledWith("t1/a.png", expect.any(Blob), {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/png",
    });
  });

  it("remonte l'erreur du stockage", async () => {
    const { client } = fakeSupabase({ uploadError: "Payload too large" });
    await expect(uploadToTestsBucket(client, "p", new Blob(), "image/png")).rejects.toThrow(
      "Upload impossible (Payload too large).",
    );
  });
});
