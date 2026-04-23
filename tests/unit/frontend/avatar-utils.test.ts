import { setAvatarImage } from "../../../src/ui/shared/utils/avatar";

describe("avatar utils", () => {
  it("renders a deterministic initial avatar when avatar url is missing", () => {
    const imageA = document.createElement("img");
    const imageB = document.createElement("img");

    setAvatarImage(imageA, "user_1", null, "/assets/logo.svg", "Ada avatar", "Ada Lovelace");
    setAvatarImage(imageB, "user_2", null, "/assets/logo.svg", "Ada avatar", "Ada Lovelace");

    expect(imageA.src.startsWith("data:image/svg+xml,")).toBe(true);
    expect(imageA.src).toBe(imageB.src);
    expect(decodeURIComponent(imageA.src.slice("data:image/svg+xml,".length))).toContain(">A<");
  });

  it("falls back to the default avatar when display name is missing", () => {
    const image = document.createElement("img");

    setAvatarImage(image, "user_1", null, "/assets/logo.svg", "User avatar");

    expect(image.src.endsWith("/assets/logo.svg")).toBe(true);
  });

  it("uses the backend avatar proxy when configured", () => {
    const image = document.createElement("img");

    setAvatarImage(
      image,
      "user_1",
      "https://avatars.example.test/user_1.png",
      "/assets/logo.svg",
      "User avatar",
      "Ada",
    );

    expect(image.src.endsWith("/avatar/user_1")).toBe(true);
  });

  it("does not reassign the same resolved avatar src on the same image element", () => {
    const image = document.createElement("img");
    const assignments: string[] = [];
    let currentSrc = "";

    Object.defineProperty(image, "src", {
      configurable: true,
      get() {
        return currentSrc;
      },
      set(value: string) {
        currentSrc = value;
        assignments.push(value);
      },
    });

    setAvatarImage(
      image,
      "user_1",
      "https://avatars.example.test/user_1.png",
      "/assets/logo.svg",
      "User avatar",
      "Ada",
    );
    setAvatarImage(
      image,
      "user_1",
      "https://avatars.example.test/user_1.png",
      "/assets/logo.svg",
      "User avatar",
      "Ada",
    );

    expect(assignments).toHaveLength(1);
  });

  it("reuses the fallback for later elements after an avatar url fails", () => {
    const fallbackSrc = "/assets/logo.svg";
    const firstImage = document.createElement("img");

    setAvatarImage(
      firstImage,
      "user_1",
      "https://avatars.example.test/user_1.png",
      fallbackSrc,
      "User avatar",
      "Ada",
    );

    firstImage.onerror?.(new Event("error"));

    const secondImage = document.createElement("img");

    setAvatarImage(
      secondImage,
      "user_1",
      "https://avatars.example.test/user_1.png",
      fallbackSrc,
      "User avatar",
      "Ada",
    );

    expect(firstImage.src.startsWith("data:image/svg+xml,")).toBe(true);
    expect(secondImage.src).toBe(firstImage.src);
  });
});
