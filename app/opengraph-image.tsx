import { ImageResponse } from "next/og";

export const alt =
  "MHtoolkit: Notice how you're doing. Without the noise.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#f4f0e6",
          color: "#19352d",
          display: "flex",
          height: "100%",
          padding: "54px",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "2px solid #19352d",
            borderRadius: "28px",
            display: "flex",
            flex: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "52px",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              <span
                style={{
                  alignItems: "center",
                  background: "#19352d",
                  borderRadius: "14px",
                  color: "#f4f0e6",
                  display: "flex",
                  height: "52px",
                  justifyContent: "center",
                  marginRight: "16px",
                  width: "52px",
                }}
              >
                M
              </span>
              MHtoolkit
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontFamily: "serif",
                  fontSize: "72px",
                  fontWeight: 600,
                  letterSpacing: "-0.055em",
                  lineHeight: 0.96,
                  maxWidth: "760px",
                }}
              >
                Notice how you&apos;re doing. Without the noise.
              </div>
              <div
                style={{
                  color: "#42685c",
                  fontSize: "28px",
                  marginTop: "28px",
                }}
              >
                A private 30-second check-in. Try it for seven days.
              </div>
            </div>
            <div style={{ display: "flex", fontSize: "23px", gap: "24px" }}>
              <span>No signup</span>
              <span>No ads</span>
              <span>Delete anytime</span>
            </div>
          </div>
          <div
            style={{
              alignItems: "center",
              background: "#e86435",
              display: "flex",
              justifyContent: "center",
              width: "240px",
            }}
          >
            <div
              style={{
                alignItems: "center",
                border: "2px solid #19352d",
                borderRadius: "999px",
                display: "flex",
                flexDirection: "column",
                height: "154px",
                justifyContent: "center",
                width: "154px",
              }}
            >
              <span style={{ fontSize: "56px", fontWeight: 700 }}>7</span>
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                days
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
