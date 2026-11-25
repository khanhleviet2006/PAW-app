// Leaflet is the browser renderer of the server-generated Leafmap document.
function connectField(map) {
  map.zoomControl.setPosition("topright");
  let tiles,
    raster,
    rasterUrl,
    changingPopup = false,
    lastSelection;
  const markers = new Map();
  const readings = L.layerGroup().addTo(map);
  const nodes = L.layerGroup().addTo(map);
  const parentOrigin = document.referrer && new URL(document.referrer).origin;
  if (!parentOrigin) return;
  function notice(data) {
    parent.postMessage(data, parentOrigin);
  }
  map.on("popupclose", () => {
    lastSelection = undefined;
    if (!changingPopup) notice({ closed: true });
  });
  map.on("zoomend", () => notice({ zoom: map.getZoom() }));
  window.addEventListener("message", ({ origin, source, data }) => {
    if (
      source !== parent ||
      origin !== parentOrigin ||
      data?.kind !== "paw-map"
    )
      return;
    const { image, points, current, selected, surface } = data;
    if (!tiles) {
      const [w, s, e, n] = image.bounds;
      const coords = points.map((f) =>
        f.geometry.coordinates.slice().reverse(),
      );
      map.fitBounds(
        coords.length
          ? coords
          : [
              [s, w],
              [n, e],
            ],
        { maxZoom: 17, padding: [30, 30] },
      );
      map.setMinZoom(Math.max(0, image.minzoom - 2));
      tiles = L.tileLayer(
        location.pathname.replace(/leafmap$/, "imagery/") +
          encodeURIComponent(image.id) +
          "/{z}/{x}/{y}.png",
        {
          bounds: [
            [s, w],
            [n, e],
          ],
          minNativeZoom: image.minzoom,
          maxNativeZoom: image.maxzoom,
          maxZoom: 22,
          attribution: image.attribution,
        },
      ).addTo(map);
    }
    nodes.clearLayers();
    for (const n of current)
      if (n.position) {
        const el = document.createElement("span");
        el.textContent = n.name + " · " + n.connectivity;
        L.circleMarker([n.position.latitude, n.position.longitude], {
          radius: 11,
          color: "#165837",
          fillOpacity: 0.2,
        })
          .bindTooltip(el)
          .addTo(nodes);
      }
    const present = new Set();
    for (const f of points) {
      const p = f.properties;
      present.add(p.id);
      if (!markers.has(p.id)) {
        const marker = L.circleMarker(
          f.geometry.coordinates.slice().reverse(),
          { radius: 7, color: "#fff", fillColor: "#1377ab", fillOpacity: 1 },
        )
          .on("click", () => notice({ id: p.id }))
          .addTo(readings);
        markers.set(p.id, marker);
      }
      markers.get(p.id).bringToFront();
    }
    for (const [id, m] of markers)
      if (!present.has(id)) {
        readings.removeLayer(m);
        markers.delete(id);
      }
    if (data.showPoints) readings.addTo(map);
    else map.removeLayer(readings);
    if (selected && selected.id !== lastSelection) {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Thông tin điểm đo");
      el.textContent = selected.text;
      changingPopup = true;
      L.popup({ autoPan: false })
        .setLatLng(selected.coords.slice().reverse())
        .setContent(el)
        .openOn(map);
      changingPopup = false;
    }
    if (!selected && lastSelection) map.closePopup();
    lastSelection = selected?.id;
    const url = surface?.image;
    if (url !== rasterUrl) {
      if (raster) map.removeLayer(raster);
      if (url) {
        const [w, s, e, n] = surface.bounds;
        raster = L.imageOverlay(url, [
          [s, w],
          [n, e],
        ]).addTo(map);
      } else raster = null;
      rasterUrl = url;
    }
    if (raster) raster.setOpacity(data.opacity);
    notice({ zoom: map.getZoom() });
  });
}
