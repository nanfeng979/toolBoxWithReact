import React from 'react';

interface AssetExplorerPanelProps {
  height: number;
  minHeight: number;
}

export class AssetExplorerPanel extends React.PureComponent<AssetExplorerPanelProps> {
  render() {
    const { height, minHeight } = this.props;

    return (
      <section
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height,
          minHeight,
          background: 'linear-gradient(180deg, rgba(32,33,36,0.96) 0%, rgba(24,25,27,0.96) 100%)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            fontSize: 12,
            color: '#c0c0c0',
            borderBottom: '1px solid #333',
            letterSpacing: 0.4
          }}
        >
          ASSET EXPLORER
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            margin: 12,
            border: '1px dashed #3f4147',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.02)'
          }}
        />
      </section>
    );
  }
}
