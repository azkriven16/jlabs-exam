import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const IP_REGEX = {
  ipv4: /^(25[0-5]|2[0-4]\d|1?\d{1,2})(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/,
  ipv6: /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1)$/,
};

const STORAGE_KEY = "ipHistory_v1";

// Fix default icon paths for many bundlers
const setLeafletDefaultIcon = () => {
  const iconUrl =
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png";
  const iconRetinaUrl =
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png";
  const shadowUrl =
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png";

  L.Icon.Default.mergeOptions({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
  });
};

export const HomeScreen = () => {
  const [geo, setGeo] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [selectedForDelete, setSelectedForDelete] = useState({});

  const mapRef = useRef(null); // DOM node
  const mapInstanceRef = useRef(null); // Leaflet map instance
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) {
      console.log("⛔ Map not ready yet or already initialized");
      return;
    }

    setLeafletDefaultIcon();

    mapInstanceRef.current = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
    });

    console.log("✅ Map initialized:", mapInstanceRef.current);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapRef.current]); // 👈 rerun when the ref is set

  // fetch current user's IP geo on mount
  useEffect(() => {
    fetchGeoFor("geo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update map when geo changes
  useEffect(() => {
    if (!geo || !mapInstanceRef.current) return;

    // ipinfo returns loc as "lat,long"
    const loc = geo.loc || "";
    const parts = loc.split(",").map((v) => parseFloat(v));
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return;

    const [lat, lon] = parts;

    // center map on the location
    mapInstanceRef.current.setView([lat, lon], 12, { animate: true });

    // add or move marker
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lon]).addTo(mapInstanceRef.current);
    } else {
      markerRef.current.setLatLng([lat, lon]);
    }

    // update popup content
    const popupParts = [];
    if (geo.ip) popupParts.push(`<strong>IP:</strong> ${geo.ip}`);
    if (geo.city) popupParts.push(`<strong>City:</strong> ${geo.city}`);
    if (geo.region) popupParts.push(`<strong>Region:</strong> ${geo.region}`);
    if (geo.country)
      popupParts.push(`<strong>Country:</strong> ${geo.country}`);
    if (geo.org) popupParts.push(`<strong>Org:</strong> ${geo.org}`);

    markerRef.current.bindPopup(popupParts.join("<br/>"));
    markerRef.current.openPopup();

    // optional: draw a small circle to show precision
    // remove existing precision circle if any
    if (mapInstanceRef.current._precisionCircle) {
      mapInstanceRef.current.removeLayer(
        mapInstanceRef.current._precisionCircle
      );
      mapInstanceRef.current._precisionCircle = null;
    }
    // add circle (small radius) — ip geolocation is not very precise so this is illustrative
    mapInstanceRef.current._precisionCircle = L.circle([lat, lon], {
      radius: 500, // meters
      opacity: 0.2,
      fillOpacity: 0.05,
    }).addTo(mapInstanceRef.current);
  }, [geo]);

  async function fetchGeoFor(query) {
    setError("");
    let url;
    if (query === "geo") url = "https://ipinfo.io/geo";
    else url = `https://ipinfo.io/${query}/geo`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch IP info");
      const data = await res.json();
      setGeo(data);

      // if this is a search by IP (not "geo" automatic), save to history
      if (query !== "geo") {
        const entry = { ip: query, data, when: new Date().toISOString() };
        setHistory((prev) => {
          const deduped = [entry, ...prev.filter((h) => h.ip !== query)].slice(
            0,
            50
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
          return deduped;
        });
      }
    } catch (err) {
      console.error(err);
      setError("Unable to fetch geolocation for the provided IP.");
    }
  }

  const handleSearch = () => {
    setError("");
    const ip = search.trim();
    if (!ip) {
      setError("Please enter an IP address.");
      return;
    }
    if (!IP_REGEX.ipv4.test(ip) && !IP_REGEX.ipv6.test(ip)) {
      setError("Please enter a valid IPv4 or IPv6 address.");
      return;
    }
    fetchGeoFor(ip);
  };

  const handleClear = () => {
    setSearch("");
    setError("");
    fetchGeoFor("geo");
  };

  const handleHistoryClick = (ip) => {
    setSearch(ip);
    fetchGeoFor(ip);
  };

  const toggleSelect = (idx) => {
    setSelectedForDelete((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const deleteSelected = () => {
    const remaining = history.filter((_, idx) => !selectedForDelete[idx]);
    setHistory(remaining);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    setSelectedForDelete({});
  };

  console.log("Map ref:", mapRef.current);
  console.log("Map instance:", mapInstanceRef.current);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Home — IP Geolocation</h1>
          <button
            className="text-sm text-red-600"
            onClick={() => {
              localStorage.removeItem("authToken");
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </header>

        <section className="bg-white p-6 rounded shadow">
          <div className="flex gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Enter IP (e.g. 8.8.8.8)"
              className="flex-1 border p-2 rounded"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Search
            </button>
            <button onClick={handleClear} className="px-4 py-2 border rounded">
              Clear
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6">
            <h3 className="font-semibold">Current Result:</h3>
            {geo ? (
              <div className="mt-2 bg-gray-50 p-4 rounded space-y-3">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(geo, null, 2)}
                </pre>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>
                    <strong>IP:</strong> {geo.ip || geo["ip"] || "N/A"}
                  </div>
                  <div>
                    <strong>City:</strong> {geo.city || "N/A"}
                  </div>
                  <div>
                    <strong>Region:</strong> {geo.region || "N/A"}
                  </div>
                  <div>
                    <strong>Country:</strong> {geo.country || "N/A"}
                  </div>
                  <div>
                    <strong>Loc (lat,long):</strong> {geo.loc || "N/A"}
                  </div>
                  <div>
                    <strong>Org:</strong> {geo.org || "N/A"}
                  </div>
                </div>

                {/* Map container */}
                {/* Always render the map container */}
                <div className="mt-4">
                  <h4 className="font-medium">
                    Map (OpenStreetMap via Leaflet):
                  </h4>
                  <div
                    ref={mapRef}
                    style={{
                      height: "500px",
                      width: "100%",
                      border: "2px solid red",
                    }}
                  />
                </div>

                {/* Keep the result info conditional */}
                {geo ? (
                  <div className="mt-2 bg-gray-50 p-4 rounded space-y-3">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(geo, null, 2)}
                    </pre>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                      <div>
                        <strong>IP:</strong> {geo.ip || "N/A"}
                      </div>
                      <div>
                        <strong>City:</strong> {geo.city || "N/A"}
                      </div>
                      <div>
                        <strong>Region:</strong> {geo.region || "N/A"}
                      </div>
                      <div>
                        <strong>Country:</strong> {geo.country || "N/A"}
                      </div>
                      <div>
                        <strong>Loc:</strong> {geo.loc || "N/A"}
                      </div>
                      <div>
                        <strong>Org:</strong> {geo.org || "N/A"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">Loading...</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">Loading...</p>
            )}
          </div>
        </section>

        <section className="bg-white p-6 rounded shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Search History</h3>
            <div>
              <button
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem(STORAGE_KEY);
                }}
                className="mr-2 text-sm text-gray-600"
              >
                Clear All
              </button>
              <button onClick={deleteSelected} className="text-sm text-red-600">
                Delete Selected
              </button>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {history.length === 0 && (
              <li className="text-sm text-gray-500">No history yet.</li>
            )}
            {history.map((h, idx) => (
              <li
                key={h.ip + idx}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!selectedForDelete[idx]}
                    onChange={() => toggleSelect(idx)}
                  />
                  <div>
                    <div
                      className="font-medium cursor-pointer"
                      onClick={() => handleHistoryClick(h.ip)}
                    >
                      {h.ip}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(h.when).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {h.data.city
                    ? `${h.data.city}, ${h.data.region}, ${h.data.country}`
                    : h.data.org || ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
