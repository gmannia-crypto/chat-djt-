import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1, user-scalable=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root {
            background-color: #0A0A0A !important;
            margin: 0;
            padding: 0;
            min-height: 100%;
            overflow: hidden;
          }
          body {
            overflow: hidden;
            -webkit-overflow-scrolling: touch;
          }
          #root {
            display: flex;
            flex: 1;
            min-height: 100vh;
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
