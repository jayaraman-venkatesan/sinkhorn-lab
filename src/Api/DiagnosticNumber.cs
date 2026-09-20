using System.Text.Json;
using System.Text.Json.Serialization;

[JsonConverter(typeof(DiagnosticNumberJsonConverter))]
public readonly record struct DiagnosticNumber(double Value)
{
    public static implicit operator DiagnosticNumber(double value) => new(value);
}

public sealed class DiagnosticNumberJsonConverter : JsonConverter<DiagnosticNumber>
{
    public override DiagnosticNumber Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options) => throw new NotSupportedException("Diagnostic numbers are response-only.");

    public override void Write(
        Utf8JsonWriter writer,
        DiagnosticNumber value,
        JsonSerializerOptions options)
    {
        double number = value.Value;
        if (double.IsFinite(number))
        {
            writer.WriteNumberValue(number);
        }
        else
        {
            writer.WriteStartObject();
            writer.WriteString(
                "nonFinite",
                double.IsNaN(number)
                    ? "NaN"
                    : double.IsPositiveInfinity(number)
                        ? "PositiveInfinity"
                        : "NegativeInfinity");
            writer.WriteEndObject();
        }
    }
}
