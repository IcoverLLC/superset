/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useEffect, useState, DetailedHTMLProps, HTMLAttributes } from 'react';

import { logging } from '@apache-superset/core/utils';
import { styled } from '@apache-superset/core/theme';

export type BackgroundPosition = 'top' | 'bottom';
interface ImageContainerProps {
  src: string;
  position: BackgroundPosition;
}

const ImageContainer = styled.div<ImageContainerProps>`
  background-image: url(${({ src }) => src});
  background-size: cover;
  background-position: center ${({ position }) => position};
  display: inline-block;
  height: calc(100% - 1px);
  width: calc(100% - 2px);
  margin: 1px 1px 0 1px;
`;
const THUMBNAIL_RETRY_DELAYS_MS = [1500, 5000, 15000];

interface ImageLoaderProps extends DetailedHTMLProps<
  HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> {
  fallback: string;
  src: string;
  isLoading?: boolean;
  position: BackgroundPosition;
}

export function ImageLoader({
  src,
  fallback,
  isLoading,
  position,
  ...rest
}: ImageLoaderProps) {
  const [imgSrc, setImgSrc] = useState<string>(fallback);

  useEffect(() => {
    let isActive = true;
    let imgURL: string | null = null;
    let retryHandle: ReturnType<typeof globalThis.setTimeout> | null = null;

    const loadImage = async (attempt = 0) => {
      if (!src) {
        return;
      }

      try {
        const response = await fetch(src);
        if (response.status === 202) {
          const retryDelayMs = THUMBNAIL_RETRY_DELAYS_MS[attempt];
          if (retryDelayMs !== undefined && isActive) {
            retryHandle = globalThis.setTimeout(() => {
              loadImage(attempt + 1).catch(errMsg => logging.error(errMsg));
            }, retryDelayMs);
          }
          return;
        }

        const blob = await response.blob();
        if (/image/.test(blob.type)) {
          imgURL = URL.createObjectURL(blob);
          if (isActive) {
            setImgSrc(imgURL);
          }
          return;
        }
      } catch (errMsg) {
        logging.error(errMsg);
      }

      if (isActive) {
        setImgSrc(fallback);
      }
    };

    setImgSrc(fallback);
    if (src) {
      loadImage().catch(errMsg => logging.error(errMsg));
    }

    return () => {
      isActive = false;
      if (retryHandle !== null) {
        globalThis.clearTimeout(retryHandle);
      }
      if (imgURL) {
        URL.revokeObjectURL(imgURL);
      }
      // theres a very brief period where isLoading is false and this component is about to unmount
      // where the stale imgSrc is briefly rendered. Setting imgSrc to fallback smoothes the transition.
      setImgSrc(fallback);
    };
  }, [src, fallback]);

  return (
    <ImageContainer
      data-test="image-loader"
      src={isLoading ? fallback : imgSrc}
      {...rest}
      position={position}
    />
  );
}
