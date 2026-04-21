export type Rolle = "admin" | "chef" | "polier" | "baustellen_leitung";

export const ROLLEN_LABEL: Record<Rolle, string> = {
  admin:              "Admin",
  chef:               "Chef",
  polier:             "Polier",
  baustellen_leitung: "Baustellen-Leitung",
};

export const ROLLE_TABS: Record<Rolle, number[]> = {
  admin:              [0, 1, 2, 3, 4, 5, 6, 7],
  chef:               [0, 1, 2, 3, 4, 5, 6, 7],
  polier:             [0, 1, 2, 3, 4, 5, 6, 7],
  baustellen_leitung: [0, 3],
};

export const KANN = {
  lohnSehen:         (r: Rolle) => r === "admin" || r === "chef",
  mitarbeiterEdit:   (r: Rolle) => r === "admin" || r === "chef" || r === "polier",
  baustellenAnlegen: (r: Rolle) => r === "admin" || r === "chef" || r === "polier",
  allesBaustellen:   (r: Rolle) => r !== "baustellen_leitung",
};