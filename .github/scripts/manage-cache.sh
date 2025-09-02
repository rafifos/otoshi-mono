#!/bin/bash

# Long-term cache management script
# Usage: ./manage-cache.sh [save|restore|cleanup]

set -euo pipefail

CACHE_NAME="font-build-cache"
CACHE_DATE=$(date +%Y%m%d-%H%M)
CACHE_FILE="${CACHE_NAME}-${CACHE_DATE}.tar.gz"
RELEASE_TAG="cache-${CACHE_DATE}"

# Directories to cache
CACHE_DIRS=(
    ".build"
    "packages/font-glyphs/lib"
    "packages/font-otl/lib"
    "packages/font/lib"
)

# Function to check if directories exist and have content
check_cache_dirs() {
    local has_content=false
    for dir in "${CACHE_DIRS[@]}"; do
        if [[ -d "$dir" && $(find "$dir" -type f | head -n 1) ]]; then
            echo "Found cache content in: $dir"
            has_content=true
        fi
    done

    if [[ "$has_content" == "false" ]]; then
        echo "No cache content found to save"
        return 1
    fi
    return 0
}

# Function to save cache as GitHub release
save_cache() {
    echo "Saving long-term build cache..."

    if ! check_cache_dirs; then
        echo "Skipping cache save - no content found"
        return 0
    fi

    # Create cache archive
    echo "Creating cache archive: $CACHE_FILE"
    tar -czf "$CACHE_FILE" "${CACHE_DIRS[@]}" 2>/dev/null || {
        echo "Failed to create cache archive"
        return 1
    }

    # Get cache size
    local cache_size
    cache_size=$(du -h "$CACHE_FILE" | cut -f1)
    echo "Cache size: $cache_size"

    # Create release with cache
    if command -v gh >/dev/null 2>&1; then
        echo "Uploading cache to GitHub release..."
        gh release create "$RELEASE_TAG" \
            --title "Build Cache $CACHE_DATE" \
            --notes "Automated build cache backup - Size: $cache_size" \
            "$CACHE_FILE" || {
            echo "Failed to create release, but cache file saved locally"
        }
    else
        echo "GitHub CLI not available. Cache saved as: $CACHE_FILE"
        echo "Manually upload this file to a release or external storage"
    fi

    echo "Cache saved successfully"
}

# Function to restore cache from GitHub releases
restore_cache() {
    echo "Restoring long-term build cache..."

    if command -v gh >/dev/null 2>&1; then
        echo "Looking for latest cache release..."

        # Find latest cache release
        local latest_cache
        latest_cache=$(gh release list --limit 10 | grep "Build Cache" | head -n1 | cut -f1) || {
            echo "No cache releases found"
            return 0
        }

        if [[ -n "$latest_cache" ]]; then
            echo "Found cache release: $latest_cache"

            # Download cache file
            gh release download "$latest_cache" --pattern "${CACHE_NAME}-*.tar.gz" || {
                echo "Failed to download cache"
                return 1
            }

            # Find downloaded cache file
            local cache_file
            cache_file=$(find . -name "${CACHE_NAME}-*.tar.gz" -type f | head -n1)

            if [[ -n "$cache_file" && -f "$cache_file" ]]; then
                echo "Extracting cache: $cache_file"
                tar -xzf "$cache_file" || {
                    echo "Failed to extract cache"
                    return 1
                }

                echo "Cache restored successfully"
                rm -f "$cache_file"  # Clean up downloaded file
            else
                echo "Downloaded cache file not found"
                return 1
            fi
        else
            echo "No cache releases available"
        fi
    else
        echo "GitHub CLI not available. Cannot restore from releases."
        echo "Manually download cache file and extract with:"
        echo "  tar -xzf ${CACHE_NAME}-*.tar.gz"
        return 1
    fi
}

# Function to cleanup old cache releases
cleanup_cache() {
    echo "Cleaning up old cache releases..."

    if command -v gh >/dev/null 2>&1; then
        # Keep only the latest 5 cache releases
        local old_releases
        old_releases=$(gh release list --limit 20 | grep "Build Cache" | tail -n +6 | cut -f1) || true

        if [[ -n "$old_releases" ]]; then
            echo "Removing old cache releases..."
            echo "$old_releases" | while read -r release; do
                echo "Deleting release: $release"
                gh release delete "$release" --yes || echo "Failed to delete $release"
            done
        else
            echo "No old releases to clean up"
        fi
    else
        echo "GitHub CLI not available. Manual cleanup required."
    fi
}

# Function to show cache status
show_status() {
    echo "=== Cache Status ==="

    # Check local cache
    echo "Local cache directories:"
    for dir in "${CACHE_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            local size
            size=$(du -sh "$dir" 2>/dev/null | cut -f1)
            local files
            files=$(find "$dir" -type f | wc -l)
            echo "  $dir: $size ($files files)"
        else
            echo "  $dir: not found"
        fi
    done

    # Check remote cache
    if command -v gh >/dev/null 2>&1; then
        echo ""
        echo "Remote cache releases:"
        gh release list --limit 5 | grep "Build Cache" | head -n 5 || echo "  No cache releases found"
    fi
}

# Main script logic
case "${1:-help}" in
    save)
        save_cache
        ;;
    restore)
        restore_cache
        ;;
    cleanup)
        cleanup_cache
        ;;
    status)
        show_status
        ;;
    help|*)
        echo "Usage: $0 {save|restore|cleanup|status}"
        echo ""
        echo "Commands:"
        echo "  save    - Save current build cache to GitHub release"
        echo "  restore - Restore build cache from latest GitHub release"
        echo "  cleanup - Remove old cache releases (keep latest 5)"
        echo "  status  - Show current cache status"
        echo ""
        echo "Requirements:"
        echo "  - GitHub CLI (gh) for release management"
        echo "  - Write access to repository for save/cleanup"
        exit 1
        ;;
esac
