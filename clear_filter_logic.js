
function clearDateFilter() {
    // Clear inputs if they exist (though re-render will likely clear them because we pass empty values, logic inside renderDetailedResults reads DOM directly? Yes.)
    // Actually renderDetailedResults reads DOM values: const startDate = document.getElementById('filter-start-date')?.value;
    // So we must clear DOM first then call render.
    // OR renderDetailedResults should accept args? It relies on DOM.

    const start = document.getElementById('filter-start-date');
    const end = document.getElementById('filter-end-date');
    if (start) start.value = '';
    if (end) end.value = '';

    filterAndRender();
}
