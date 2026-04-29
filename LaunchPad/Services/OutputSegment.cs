using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace LaunchPad.Services
{
    // Typed segment in the streaming output buffer. Job.Outcome stores a JSON array
    // of these so the Details renderer can paint text and PowerShell objects-as-tables
    // side-by-side. Pre-feature outcomes are plain text and render via the parse-fail
    // fallback in the JS renderer.
    public class OutputSegment
    {
        [JsonPropertyName("t")]
        public string T { get; set; } = "";

        // Text segments only.
        [JsonPropertyName("v")]
        public string? V { get; set; }

        // Table segments only.
        [JsonPropertyName("cols")]
        public List<string>? Cols { get; set; }

        [JsonPropertyName("rows")]
        public List<List<object?>>? Rows { get; set; }
    }
}
