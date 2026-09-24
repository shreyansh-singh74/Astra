#include <vector>
#include <cmath>
#include <algorithm>

// Genuinely independent solution: segment-based feasibility check.
// Instead of simulating the battery step by step, the route is split
// at every charging pad and each stretch is validated on its own.

struct Node {
    int x;
    int y;
    bool operator==(const Node& other) const {
        return x == other.x && y == other.y;
    }
};

// True if travelling from index `start` to index `end` never consumes
// the full 100-unit battery before reaching the next pad.
bool stretchIsAffordable(const std::vector<Node>& route, size_t start, size_t end) {
    int spent = 0;
    for (size_t i = start + 1; i <= end; ++i) {
        spent += std::abs(route[i].x - route[i - 1].x) + std::abs(route[i].y - route[i - 1].y);
        if (spent >= 100) {
            return false;
        }
    }
    return true;
}

bool canCompleteDelivery(const std::vector<Node>& route, const std::vector<Node>& chargingPads) {
    if (route.size() < 2) {
        return true;
    }

    size_t segmentStart = 0;
    for (size_t i = 1; i < route.size(); ++i) {
        if (std::find(chargingPads.begin(), chargingPads.end(), route[i]) != chargingPads.end()) {
            if (!stretchIsAffordable(route, segmentStart, i)) {
                return false;
            }
            segmentStart = i;
        }
    }
    return stretchIsAffordable(route, segmentStart, route.size() - 1);
}